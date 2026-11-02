import type { ConversationSummary, UploadedFile } from '#shared/types/conversation';

export function useConversations() {
    const conversations = useState<ConversationSummary[]>('conversations', () => []);
    const { name: creatorName } = useUserName();

    function upsert(conversation: ConversationSummary): void {
        const others = conversations.value.filter(existing => existing.id !== conversation.id);
        conversations.value = conversation.archivedAt === null
            ? [conversation, ...others].sort((a, b) => b.lastActivityAt - a.lastActivityAt)
            : others;
    }

    async function load(): Promise<void> {
        conversations.value = await apiFetch<ConversationSummary[]>('conversations');
    }

    async function start(text: string, attachments: UploadedFile[]): Promise<ConversationSummary> {
        const conversation = await apiFetch<ConversationSummary>('conversations', { method: 'POST', body: { text, attachments, creatorName: creatorName.value } });
        upsert(conversation);
        return conversation;
    }

    function loadArchived(): Promise<ConversationSummary[]> {
        return apiFetch<ConversationSummary[]>('conversations', { query: { archived: 'true' } });
    }

    async function restore(conversationId: string): Promise<void> {
        upsert(await apiFetch<ConversationSummary>(`conversations/${conversationId}/restore`, { method: 'POST' }));
    }

    return { conversations, upsert, load, loadArchived, start, restore };
}
