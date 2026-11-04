import type { ConversationSummary } from '#shared/types/conversation';

export function unreadConversationIds(conversations: ConversationSummary[], userId: string | null, reads: Record<string, number>, openId: string | null): string[] {
    return conversations
        .filter(conversation => conversation.archivedAt === null
            && conversation.id !== openId
            && userId !== null
            && conversation.participantIds.includes(userId)
            && (conversation.lastAnswerAt ?? 0) > (reads[conversation.id] ?? 0))
        .map(conversation => conversation.id);
}
