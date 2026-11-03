const FAILED_ANSWER: Record<string, string> = {
    en: 'The answer could not be completed',
    de: 'Die Antwort konnte nicht abgeschlossen werden',
    fr: 'La réponse n\'a pas pu être terminée',
    nl: 'Het antwoord kon niet worden voltooid',
    es: 'No se pudo completar la respuesta',
    it: 'Non è stato possibile completare la risposta',
};

export function failedAnswerText(language: string | null | undefined): string {
    return FAILED_ANSWER[language ?? ''] ?? FAILED_ANSWER.en;
}

export interface StoredSubscription {
    endpoint: string;
    userId: string;
    p256dh: string;
    auth: string;
}

export interface PushPayload {
    title: string;
    body: string;
    conversationId: string;
    userId: string;
    agentName: string;
    failed: boolean;
}

export interface AnswerFinished {
    conversationId: string;
    conversationTitle: string;
    creatorId: string | null;
    lastSenderId: string | null;
    agentName: string;
    text: string;
    failed: boolean;
}

export interface PushDelivery {
    subscriptionsFor(userIds: string[]): StoredSubscription[];
    languageOf(userId: string): string | null;
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

export function recipientIds(creatorId: string | null, lastSenderId: string | null): string[] {
    return [...new Set([creatorId, lastSenderId].filter((id): id is string => !!id))];
}

export function buildPayload(event: AnswerFinished, userId: string, language: string | null = null): PushPayload {
    const snippet = answerSnippet(event.text);
    return {
        title: event.conversationTitle,
        body: event.failed || !snippet ? `${event.agentName}: ${failedAnswerText(language)}` : `${event.agentName}: ${snippet}`,
        conversationId: event.conversationId,
        userId,
        agentName: event.agentName,
        failed: event.failed || !snippet,
    };
}

export function createAnswerNotifier(delivery: PushDelivery): (event: AnswerFinished) => Promise<void> {
    return async (event) => {
        try {
            const targets = delivery
                .subscriptionsFor(recipientIds(event.creatorId, event.lastSenderId))
                .filter(subscription => !delivery.isAppVisible(subscription));
            await Promise.all(targets.map(async (subscription) => {
                try {
                    if (await delivery.send(subscription, buildPayload(event, subscription.userId, delivery.languageOf(subscription.userId))) === 'gone') {
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
