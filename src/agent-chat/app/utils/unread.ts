import type { ConversationSummary } from '#shared/types/conversation';

export function unreadConversationIds(conversations: ConversationSummary[], userId: string | null, counts: Record<string, number>, openId: string | null): string[] {
    return conversations
        .filter(conversation => conversation.archivedAt === null
            && conversation.id !== openId
            && userId !== null
            && conversation.participantIds.includes(userId)
            && (counts[conversation.id] ?? 0) > 0)
        .map(conversation => conversation.id);
}
