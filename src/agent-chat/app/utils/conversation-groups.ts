import type { ConversationSummary } from '#shared/types/conversation';

const DAY_MS = 86_400_000;

const RECENCY_GROUPS = [
    { label: 'Today', maxDaysAgo: 0 },
    { label: 'Yesterday', maxDaysAgo: 1 },
    { label: 'Previous 7 days', maxDaysAgo: 7 },
    { label: 'Previous 30 days', maxDaysAgo: 30 },
    { label: 'Older', maxDaysAgo: Number.POSITIVE_INFINITY },
] as const;

export interface ConversationGroup {
    label: string;
    conversations: ConversationSummary[];
}

function daysAgo(timestamp: number, todayStart: number): number {
    return Math.max(0, Math.ceil((todayStart - timestamp) / DAY_MS));
}

export function groupByRecency(conversations: ConversationSummary[], now = new Date()): ConversationGroup[] {
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const groups = RECENCY_GROUPS.map(group => ({ label: group.label, conversations: [] as ConversationSummary[] }));
    for (const conversation of conversations) {
        const age = daysAgo(conversation.lastActivityAt, todayStart);
        const index = RECENCY_GROUPS.findIndex(group => age <= group.maxDaysAgo);
        groups[index]!.conversations.push(conversation);
    }
    return groups.filter(group => group.conversations.length > 0);
}
