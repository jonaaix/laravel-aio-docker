import type { UsageSnapshot } from './account';
import type { UIMessage } from 'ai';

export type ConversationStatus = 'running' | 'paused';

export interface ConversationSummary {
    id: string;
    title: string;
    status: ConversationStatus;
    turnActive: boolean;
    lastActivityAt: number;
    archivedAt: number | null;
}

export type TurnOutcome = 'completed' | 'stopped' | 'failed';

export interface ChatMessageMetadata {
    createdAt: number;
    outcome?: TurnOutcome;
    error?: string;
}

export type ChatMessage = UIMessage<ChatMessageMetadata>;

export type ChatPart = ChatMessage['parts'][number];

export interface MessagePage {
    messages: ChatMessage[];
    hasEarlier: boolean;
}

export interface ConversationDetail extends ConversationSummary, MessagePage {}

export type ConversationEvent =
    | { type: 'message'; message: ChatMessage }
    | { type: 'part'; messageId: string; index: number; part: ChatPart }
    | { type: 'delta'; messageId: string; index: number; text: string }
    | { type: 'status'; status: ConversationStatus; turnActive: boolean }
    | { type: 'title'; title: string }
    | { type: 'error'; message: string };

export type ConversationListEvent =
    | { type: 'conversation'; conversation: ConversationSummary }
    | { type: 'usage'; usage: UsageSnapshot };
