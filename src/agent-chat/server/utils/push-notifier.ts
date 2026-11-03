export const FAILED_ANSWER = 'The answer could not be completed';

export interface StoredSubscription {
    endpoint: string;
    userId: string;
    p256dh: string;
    auth: string;
    language: string | null;
    vapidPublicKey: string;
    vapidPrivateKey: string;
    hubRef: string | null;
}

export interface PushPayload {
    title: string;
    body: string;
    conversationId: string;
    userId: string;
    hubRef?: string | null;
}

export interface AnswerFinished {
    conversationId: string;
    conversationTitle: string;
    participantIds: string[];
    mutedUserIds: string[];
    agentName: string;
    text: string;
    failed: boolean;
}

export interface PushDelivery {
    subscriptionsFor(userIds: string[]): StoredSubscription[];
    languageOf(subscription: StoredSubscription): string | null;
    translate(key: string, language: string | null): string;
    isAppVisible(subscription: StoredSubscription): boolean;
    send(subscription: StoredSubscription, payload: PushPayload): Promise<'sent' | 'gone'>;
    forget(subscription: StoredSubscription): void;
    report(error: unknown): void;
}

const SNIPPET_LENGTH = 140;
const SECTION_BAR = /^\s*╌{3,}\s*$/;

export function answerSnippet(text: string, limit = SNIPPET_LENGTH): string {
    const plain = text
        .split('\n')
        .filter(line => !SECTION_BAR.test(line))
        .join(' ')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
        .replace(/[*_`#>]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    return plain.length > limit ? `${plain.slice(0, limit - 1).trimEnd()}…` : plain;
}

export function recipientIds(participantIds: string[], mutedUserIds: string[]): string[] {
    return participantIds.filter(id => !mutedUserIds.includes(id));
}

export function buildPayload(event: AnswerFinished, userId: string, failedSentence: string = FAILED_ANSWER): PushPayload {
    const snippet = answerSnippet(event.text);
    return {
        title: event.conversationTitle,
        body: event.failed ? `${event.agentName}: ${failedSentence}` : snippet ? `${event.agentName}: ${snippet}` : event.agentName,
        conversationId: event.conversationId,
        userId,
    };
}

export function createAnswerNotifier(delivery: PushDelivery): (event: AnswerFinished) => Promise<void> {
    return async (event) => {
        try {
            const targets = delivery
                .subscriptionsFor(recipientIds(event.participantIds, event.mutedUserIds))
                .filter(subscription => !delivery.isAppVisible(subscription));
            await Promise.all(targets.map(async (subscription) => {
                try {
                    if (await delivery.send(subscription, { ...buildPayload(event, subscription.userId, delivery.translate(FAILED_ANSWER, delivery.languageOf(subscription))), hubRef: subscription.hubRef }) === 'gone') {
                        delivery.forget(subscription);
                    }
                }
                catch (error) {
                    delivery.report(error);
                }
            }));
        }
        catch (error) {
            delivery.report(error);
        }
    };
}
