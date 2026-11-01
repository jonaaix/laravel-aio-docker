import type { ConversationListEvent, ConversationSummary } from '#shared/types/conversation';

export function useConversations() {
  const conversations = useState<ConversationSummary[]>('conversations', () => []);

  function upsert(conversation: ConversationSummary): void {
    const others = conversations.value.filter(existing => existing.id !== conversation.id);
    conversations.value = [conversation, ...others].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
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

  return { conversations, load, subscribe, start };
}
