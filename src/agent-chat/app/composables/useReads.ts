import type { ConversationSummary } from '#shared/types/conversation';

export function useReads() {
    const reads = useState<Record<string, number> | null>('reads', () => null);

    async function load(): Promise<void> {
        reads.value = await apiFetch<Record<string, number>>('reads');
    }

    function apply(conversationId: string, seenAnswerAt: number): void {
        if (reads.value && (reads.value[conversationId] ?? 0) < seenAnswerAt) {
            reads.value = { ...reads.value, [conversationId]: seenAnswerAt };
        }
    }

    function markRead(conversation: ConversationSummary): void {
        const answeredAt = conversation.lastAnswerAt ?? 0;
        if (!reads.value || answeredAt <= (reads.value[conversation.id] ?? 0)) {
            return;
        }
        apply(conversation.id, answeredAt);
        void apiFetch(`conversations/${conversation.id}/read`, { method: 'PUT', body: { seenAnswerAt: answeredAt } }).catch(() => undefined);
    }

    return { reads, load, apply, markRead };
}
