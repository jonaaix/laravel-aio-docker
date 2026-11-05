import type { UsageSnapshot } from './account';
import type { ChatUser } from './user';
import type { UIMessage } from 'ai';

export type ConversationStatus = 'running' | 'paused';

export interface UploadedFile {
    id: string;
    filename: string;
    mediaType: string;
    size: number;
}

export interface BackgroundTask {
    id: string;
    description: string;
    startedAt: number;
}

export interface QueuedMessage {
    ref: string;
    parts: ChatPart[];
    createdAt: number;
    agentId: string;
}

export interface ConversationSummary {
    id: string;
    title: string;
    creatorId: string | null;
    participantIds: string[];
    mutedUserIds: string[];
    lastAnswerAt: number | null;
    agentIds: string[];
    status: ConversationStatus;
    turnActive: boolean;
    answeringAgentId: string | null;
    backgroundTasks: BackgroundTask[];
    queuedMessages: QueuedMessage[];
    lastActivityAt: number;
    archivedAt: number | null;
}

export type TurnOutcome = 'completed' | 'stopped' | 'failed';

export interface FileChange {
    path: string;
    previousPath: string | null;
    status: 'added' | 'modified' | 'deleted' | 'renamed';
    added: number;
    removed: number;
    binary: boolean;
    lines: string[];
    truncated: boolean;
    order?: number;
}

export interface TurnCommit {
    hash: string;
    title: string;
    body: string;
    order: number;
}

export interface TurnFileChanges {
    files: FileChange[];
    commits?: TurnCommit[];
}

export interface ChatMessageMetadata {
    createdAt: number;
    senderId?: string;
    agentId?: string;
    outcome?: TurnOutcome;
    error?: string;
}

export type ChatMessage = UIMessage<ChatMessageMetadata>;

export type ChatPart = ChatMessage['parts'][number];

export interface MessagePage {
    messages: ChatMessage[];
    hasEarlier: boolean;
}

export interface ConversationDetail extends ConversationSummary, MessagePage {
    workingDir: string;
}

export type ConversationEvent =
    | { type: 'message'; message: ChatMessage }
    | { type: 'part'; messageId: string; index: number; part: ChatPart }
    | { type: 'delta'; messageId: string; index: number; text: string }
    | { type: 'status'; status: ConversationStatus; turnActive: boolean; answeringAgentId: string | null; backgroundTasks: BackgroundTask[]; queuedMessages: QueuedMessage[] }
    | { type: 'title'; title: string }
    | { type: 'error'; message: string };

export type ConversationListEvent =
    | { type: 'conversation'; conversation: ConversationSummary }
    | { type: 'usage'; usage: UsageSnapshot }
    | { type: 'user'; user: ChatUser }
    | { type: 'agents' }
    | { type: 'account' }
    | { type: 'devices'; userId: string }
    | { type: 'read'; userId: string; conversationId: string; seenAnswerAt: number };
