import type { ConversationListEvent, ConversationSummary } from '#shared/types/conversation';

export function useConversations() {
    const conversations = useState<ConversationSummary[]>('conversations', () => []);

    function upsert(conversation: ConversationSummary): void {
        const others = conversations.value.filter(existing => existing.id !== conversation.id);
        conversations.value = conversation.archivedAt === null
            ? [conversation, ...others].sort((a, b) => b.lastActivityAt - a.lastActivityAt)
            : others;
    }

    async function load(): Promise<void> {
        conversations.value = await apiFetch<ConversationSummary[]>('conversations');
    }

    function subscribe(): () => void {
        return subscribeEvents<ConversationListEvent>('events', event => upsert(event.conversation));
    }

    async function start(text: string): Promise<ConversationSummary> {
        const conversation = await apiFetch<ConversationSummary>('conversations', { method: 'POST', body: { text } });
        upsert(conversation);
        return conversation;
    }

    function loadArchived(): Promise<ConversationSummary[]> {
        return apiFetch<ConversationSummary[]>('conversations', { query: { archived: 'true' } });
    }

    async function restore(conversationId: string): Promise<void> {
        upsert(await apiFetch<ConversationSummary>(`conversations/${conversationId}/restore`, { method: 'POST' }));
    }

    return { conversations, load, loadArchived, subscribe, start, restore };
}
