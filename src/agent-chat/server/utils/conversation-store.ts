import { randomUUID } from 'node:crypto';
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, max, ne, or } from 'drizzle-orm';
import { conversations, messages } from '../database/schema';
import type { ChatMessage, ConversationDetail, ConversationStatus, ConversationSummary, MessagePage } from '../../shared/types/conversation';
import type { TurnMetrics } from './turn-metrics';
import type { UserRow } from './user-store';

type ConversationRow = typeof conversations.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

const MESSAGE_PAGE_SIZE = 50;

function toChatMessage(row: Pick<MessageRow, 'id' | 'role' | 'parts' | 'createdAt'> & Partial<Pick<MessageRow, 'outcome' | 'errorMessage' | 'senderId' | 'agentId'>>): ChatMessage {
    return {
        id: row.id,
        role: row.role,
        parts: row.parts,
        metadata: { createdAt: row.createdAt, senderId: row.senderId ?? undefined, agentId: row.agentId ?? undefined, outcome: row.outcome ?? undefined, error: row.errorMessage ?? undefined },
    };
}

export function listConversations(archived: boolean): ConversationSummary[] {
    return useDatabase()
        .select()
        .from(conversations)
        .where(archived ? isNotNull(conversations.archivedAt) : isNull(conversations.archivedAt))
        .orderBy(desc(archived ? conversations.archivedAt : conversations.lastActivityAt))
        .all()
        .map(summarize);
}

export function findConversation(id: string): ConversationRow | undefined {
    return useDatabase().select().from(conversations).where(eq(conversations.id, id)).get();
}

export function getConversationDetail(id: string): ConversationDetail | undefined {
    const row = findConversation(id);
    if (!row) {
        return undefined;
    }
    return { ...summarize(row), workingDir: row.workingDir, ...messagePage(id, null) };
}

export function getMessagesBefore(conversationId: string, beforeMessageId: string): MessagePage | undefined {
    const before = useDatabase()
        .select({ seq: messages.seq })
        .from(messages)
        .where(and(eq(messages.id, beforeMessageId), eq(messages.conversationId, conversationId)))
        .get();
    return before ? messagePage(conversationId, before.seq) : undefined;
}

function messagePage(conversationId: string, beforeSeq: number | null): MessagePage {
    const rows = useDatabase()
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), beforeSeq === null ? undefined : lt(messages.seq, beforeSeq)))
        .orderBy(desc(messages.seq))
        .limit(MESSAGE_PAGE_SIZE + 1)
        .all();
    return {
        messages: rows.slice(0, MESSAGE_PAGE_SIZE).reverse().map(toChatMessage),
        hasEarlier: rows.length > MESSAGE_PAGE_SIZE,
    };
}

export function createConversation(title: string, workingDir: string, creatorId: string | null): ConversationRow {
    const now = Date.now();
    const row: ConversationRow = {
        id: randomUUID(),
        title,
        titleRenamed: false,
        creatorId,
        status: 'paused',
        workingDir,
        agentSessionRef: randomUUID(),
        agentSessionStarted: false,
        announcedAgents: [],
        createdAt: now,
        lastActivityAt: now,
        archivedAt: null,
    };
    useDatabase().insert(conversations).values(row).run();
    return row;
}

export function updateConversation(id: string, changes: Partial<Omit<ConversationRow, 'id'>>): void {
    useDatabase().update(conversations).set(changes).where(eq(conversations.id, id)).run();
}

export function setConversationArchived(id: string, archivedAt: number | null): ConversationSummary {
    updateConversation(id, { archivedAt });
    const conversation = summarize(findConversation(id)!);
    publishConversationListEvent({ type: 'conversation', conversation });
    return conversation;
}

export function setConversationStatus(id: string, status: ConversationStatus): void {
    updateConversation(id, { status, lastActivityAt: Date.now() });
}

export function appendMessage(conversationId: string, role: ChatMessage['role'], parts: ChatMessage['parts'], agentId: string, sender: UserRow | null = null): ChatMessage {
    const db = useDatabase();
    const next = db
        .select({ value: max(messages.seq) })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .get();
    const row = {
        id: randomUUID(),
        conversationId,
        seq: (next?.value ?? 0) + 1,
        role,
        parts,
        senderId: sender?.id ?? null,
        agentId,
        createdAt: Date.now(),
    } satisfies typeof messages.$inferInsert;
    db.insert(messages).values(row).run();
    updateConversation(conversationId, { lastActivityAt: row.createdAt });
    return toChatMessage(row);
}

export function listUserMessages(conversationId: string): ChatMessage[] {
    return useDatabase()
        .select({ id: messages.id, role: messages.role, parts: messages.parts, createdAt: messages.createdAt })
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.role, 'user')))
        .orderBy(messages.seq)
        .all()
        .map(toChatMessage);
}

export function lastUserSenderId(conversationId: string, agentId: string): string | null | undefined {
    const last = useDatabase()
        .select({ senderId: messages.senderId })
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.role, 'user'), eq(messages.agentId, agentId)))
        .orderBy(desc(messages.seq))
        .limit(1)
        .get();
    return last ? last.senderId : undefined;
}

export function lastAnsweringAgentId(conversationId: string): string | null {
    return useDatabase()
        .select({ agentId: messages.agentId })
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.role, 'assistant'), isNotNull(messages.agentId)))
        .orderBy(desc(messages.seq))
        .limit(1)
        .get()?.agentId ?? null;
}

export function missedMessages(conversationId: string, agentId: string, excludedMessageId: string | null, limit: number): ChatMessage[] {
    const database = useDatabase();
    const seen = database
        .select({ value: max(messages.seq) })
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.agentId, agentId)))
        .get()?.value ?? 0;
    return database
        .select()
        .from(messages)
        .where(and(
            eq(messages.conversationId, conversationId),
            gt(messages.seq, seen),
            inArray(messages.role, ['user', 'assistant']),
            or(isNull(messages.agentId), ne(messages.agentId, agentId)),
            excludedMessageId ? ne(messages.id, excludedMessageId) : undefined,
        ))
        .orderBy(desc(messages.seq))
        .limit(limit)
        .all()
        .reverse()
        .map(toChatMessage);
}

export function conversationSenderIds(conversationId: string): string[] {
    return useDatabase()
        .selectDistinct({ senderId: messages.senderId })
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), isNotNull(messages.senderId)))
        .all()
        .map(row => row.senderId!);
}

export function saveMessageParts(conversationId: string, messageId: string, parts: ChatMessage['parts']): void {
    useDatabase()
        .update(messages)
        .set({ parts })
        .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
        .run();
}

export function saveTurnMetrics(conversationId: string, messageId: string, metrics: TurnMetrics): void {
    useDatabase()
        .update(messages)
        .set(metrics)
        .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
        .run();
}

export function markRunningConversationsPaused(): void {
    useDatabase().update(conversations).set({ status: 'paused' }).where(eq(conversations.status, 'running')).run();
}
