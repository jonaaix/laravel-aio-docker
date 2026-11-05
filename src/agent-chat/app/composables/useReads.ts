import type { ConversationSummary } from '#shared/types/conversation';

const COUNTS_REFRESH_DELAY_MS = 150;

let countsRefresh: ReturnType<typeof setTimeout> | undefined;

export function useReads() {
    const reads = useState<Record<string, number> | null>('reads', () => null);
    const counts = useState<Record<string, number> | null>('unread-counts', () => null);

    async function loadCounts(): Promise<void> {
        counts.value = await apiFetch<Record<string, number>>('unread');
    }

    async function load(): Promise<void> {
        const [seen] = await Promise.all([apiFetch<Record<string, number>>('reads'), loadCounts()]);
        reads.value = seen;
    }

    function refreshCounts(): void {
        clearTimeout(countsRefresh);
        countsRefresh = setTimeout(() => void loadCounts().catch(() => undefined), COUNTS_REFRESH_DELAY_MS);
    }

    function seenUpTo(conversationId: string, seenAt: number): boolean {
        if (!reads.value || (reads.value[conversationId] ?? 0) >= seenAt) {
            return false;
        }
        reads.value = { ...reads.value, [conversationId]: seenAt };
        return true;
    }

    function apply(conversationId: string, seenAt: number): void {
        if (seenUpTo(conversationId, seenAt)) {
            refreshCounts();
        }
    }

    function markRead(conversation: ConversationSummary): void {
        const postedAt = conversation.lastPostedAt ?? 0;
        if (!seenUpTo(conversation.id, postedAt)) {
            return;
        }
        if (counts.value?.[conversation.id]) {
            counts.value = { ...counts.value, [conversation.id]: 0 };
        }
        void apiFetch(`conversations/${conversation.id}/read`, { method: 'PUT', body: { seenAnswerAt: postedAt } }).catch(() => undefined);
    }

    return { reads, counts, load, refreshCounts, apply, markRead };
}
