import type { ChatStatus } from 'ai';
import type { ChatMessage, ConversationDetail, ConversationEvent, ConversationStatus, ConversationSummary, MessagePage } from '#shared/types/conversation';

export function useConversation(conversationId: string) {
    const title = ref('');
    const workingDir = ref('');
    const messages = ref<ChatMessage[]>([]);
    const status = ref<ConversationStatus>('paused');
    const turnActive = ref(false);
    const archivedAt = ref<number | null>(null);
    const loaded = ref(false);
    const hasEarlier = ref(false);
    const loadingEarlier = ref(false);
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
        if (event.type === 'delta') {
            const part = messages.value.find(candidate => candidate.id === event.messageId)?.parts[event.index];
            if (part && (part.type === 'text' || part.type === 'reasoning')) {
                part.text += event.text;
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
        workingDir.value = detail.workingDir;
        messages.value = detail.messages;
        hasEarlier.value = detail.hasEarlier;
        applySummary(detail);
        loaded.value = true;
    }

    function applySummary(summary: ConversationSummary): void {
        status.value = summary.status;
        turnActive.value = summary.turnActive;
        archivedAt.value = summary.archivedAt;
    }

    async function loadEarlier(): Promise<void> {
        const oldest = messages.value[0];
        if (!oldest || !hasEarlier.value || loadingEarlier.value) {
            return;
        }
        loadingEarlier.value = true;
        try {
            const page = await apiFetch<MessagePage>(`conversations/${conversationId}/messages`, { query: { before: oldest.id } });
            messages.value = [...page.messages, ...messages.value];
            hasEarlier.value = page.hasEarlier;
        }
        finally {
            loadingEarlier.value = false;
        }
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

    async function archive(): Promise<void> {
        applySummary(await apiFetch<ConversationSummary>(`conversations/${conversationId}/archive`, { method: 'POST' }));
    }

    async function restore(): Promise<void> {
        applySummary(await apiFetch<ConversationSummary>(`conversations/${conversationId}/restore`, { method: 'POST' }));
    }

    return {
        title,
        workingDir,
        messages,
        status,
        turnActive,
        archivedAt,
        loaded,
        hasEarlier,
        loadingEarlier,
        error,
        chatStatus,
        load,
        loadEarlier,
        subscribe,
        send,
        stop,
        pause,
        archive,
        restore,
    };
}
