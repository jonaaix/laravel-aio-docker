import webpush from 'web-push';
import type { ChatMessage } from '../../shared/types/conversation';
import { plainMessageText } from './agent-prompts';
import { findAgent } from './agent-store';
import { conversationMutedUserIds, conversationParticipantIds, findConversation } from './conversation-store';
import { createAnswerNotifier, type PushDelivery } from './push-notifier';
import { isAppVisible } from './push-presence';
import { findUser } from './user-store';
import { serverText } from './push-texts';
import { removePushSubscription, subscriptionsForUsers } from './push-store';

const TTL_SECONDS = 60 * 60;
const GONE_STATUS_CODES = new Set([400, 403, 404, 410]);

const delivery: PushDelivery = {
    subscriptionsFor: subscriptionsForUsers,
    languageOf: subscription => findUser(subscription.userId)?.language ?? subscription.language ?? null,
    translate: serverText,
    isAppVisible: subscription => isAppVisible(subscription.endpoint, subscription.userId),
    send: async (subscription, payload) => {
        try {
            await webpush.sendNotification(
                { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
                JSON.stringify(payload),
                { vapidDetails: { subject: useRuntimeConfig().public.hubUrl, publicKey: subscription.vapidPublicKey, privateKey: subscription.vapidPrivateKey }, TTL: TTL_SECONDS, urgency: 'normal', topic: payload.conversationId.replace(/-/g, '') },
            );
            return 'sent';
        }
        catch (error) {
            if (GONE_STATUS_CODES.has((error as { statusCode?: number }).statusCode ?? 0)) {
                return 'gone';
            }
            throw error;
        }
    },
    forget: subscription => removePushSubscription(subscription.endpoint, subscription.userId),
    report: error => console.error('[push]', error),
};

const notify = createAnswerNotifier(delivery);

export function notifyAnswerFinished(conversationId: string, agentId: string, message: ChatMessage | null, failed: boolean): void {
    const conversation = findConversation(conversationId);
    const agent = findAgent(agentId);
    if (!conversation || !agent) {
        return;
    }
    void notify({
        conversationId,
        conversationTitle: conversation.title,
        participantIds: conversationParticipantIds(conversationId, conversation.creatorId),
        mutedUserIds: conversationMutedUserIds(conversationId),
        agentName: agent.name,
        text: message ? plainMessageText(message) : '',
        failed,
    });
}
