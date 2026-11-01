import type { ChatStatus } from 'ai';
import type { ChatMessage, ConversationDetail, ConversationEvent, ConversationStatus } from '#shared/types/conversation';

export function useConversation(conversationId: string) {
  const title = ref('');
  const messages = ref<ChatMessage[]>([]);
  const status = ref<ConversationStatus>('paused');
  const turnActive = ref(false);
  const error = ref<Error | undefined>();

  const chatStatus = computed<ChatStatus>(() => {
    if (error.value) {
      return 'error';
    }
    if (!turnActive.value) {
      return 'ready';
    }
    return messages.value.at(-1)?.role === 'user' ? 'submitted' : 'streaming';
  });

  function apply(event: ConversationEvent): void {
    if (event.type === 'message') {
      messages.value = [...messages.value.filter(message => message.id !== event.message.id), event.message];
    }
    if (event.type === 'part') {
      const message = messages.value.find(candidate => candidate.id === event.messageId);
      if (message) {
        message.parts[event.index] = event.part;
      }
    }
    if (event.type === 'status') {
      status.value = event.status;
      turnActive.value = event.turnActive;
    }
    if (event.type === 'title') {
      title.value = event.title;
    }
    if (event.type === 'error') {
      error.value = new Error(event.message);
    }
  }

  async function load(): Promise<void> {
    const detail = await apiFetch<ConversationDetail>(`conversations/${conversationId}`);
    title.value = detail.title;
    messages.value = detail.messages;
    status.value = detail.status;
    turnActive.value = detail.turnActive;
  }

  function subscribe(): () => void {
    return subscribeEvents<ConversationEvent>(`conversations/${conversationId}/events`, apply);
  }

  async function send(text: string): Promise<void> {
    error.value = undefined;
    turnActive.value = true;
    await apiFetch(`conversations/${conversationId}/messages`, { method: 'POST', body: { text } });
  }

  async function stop(): Promise<void> {
    await apiFetch(`conversations/${conversationId}/stop`, { method: 'POST' });
  }

  async function pause(): Promise<void> {
    await apiFetch(`conversations/${conversationId}/pause`, { method: 'POST' });
  }

  return { title, messages, status, turnActive, error, chatStatus, load, subscribe, send, stop, pause };
}
