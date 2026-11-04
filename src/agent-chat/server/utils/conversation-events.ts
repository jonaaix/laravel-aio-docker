import type { ConversationEvent, ConversationListEvent } from '../../shared/types/conversation';

type Listener<T> = (event: T) => void;

const conversationListeners = new Map<string, Set<Listener<ConversationEvent>>>();
const listListeners = new Set<Listener<ConversationListEvent>>();
const blockListeners = new Set<Listener<string>>();

export function subscribeConversation(conversationId: string, listener: Listener<ConversationEvent>): () => void {
    const listeners = conversationListeners.get(conversationId) ?? new Set();
    listeners.add(listener);
    conversationListeners.set(conversationId, listeners);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            conversationListeners.delete(conversationId);
        }
    };
}

export function publishConversationEvent(conversationId: string, event: ConversationEvent): void {
    conversationListeners.get(conversationId)?.forEach(listener => listener(event));
}

export function subscribeConversationList(listener: Listener<ConversationListEvent>): () => void {
    listListeners.add(listener);
    return () => listListeners.delete(listener);
}

export function publishConversationListEvent(event: ConversationListEvent): void {
    listListeners.forEach(listener => listener(event));
}

export function onUserBlocked(listener: Listener<string>): () => void {
    blockListeners.add(listener);
    return () => blockListeners.delete(listener);
}

export function publishUserBlocked(userId: string): void {
    blockListeners.forEach(listener => listener(userId));
}
