import webpush from 'web-push';
import type { ChatMessage } from '../../shared/types/conversation';
import { plainMessageText } from './agent-prompts';
import { findAgent } from './agent-store';
import { findConversation } from './conversation-store';
import { createAnswerNotifier, type PushDelivery } from './push-notifier';
import { isAppVisible } from './push-presence';
import { vapidDetails } from './push-keys';
import { latestSenderId, removePushSubscription, subscriptionsForUsers } from './push-store';

const TTL_SECONDS = 60 * 60;
const GONE_STATUS_CODES = new Set([404, 410]);

const delivery: PushDelivery = {
    subscriptionsFor: subscriptionsForUsers,
    isAppVisible: subscription => isAppVisible(subscription.endpoint, subscription.userId),
    send: async (subscription, payload) => {
        try {
            await webpush.sendNotification(
                { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
                JSON.stringify(payload),
                { vapidDetails: vapidDetails(), TTL: TTL_SECONDS, urgency: 'normal', topic: payload.conversationId.replace(/-/g, '') },
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

export function notifyAnswerFinished(conversationId: string, agentId: string, message: ChatMessage | null): void {
    const conversation = findConversation(conversationId);
    const agent = findAgent(agentId);
    if (!conversation || !agent || !message) {
        return;
    }
    void notify({
        conversationId,
        conversationTitle: conversation.title,
        creatorId: conversation.creatorId,
        lastSenderId: latestSenderId(conversationId),
        agentName: agent.name,
        text: plainMessageText(message),
        failed: message.metadata?.outcome === 'failed',
    });
}
