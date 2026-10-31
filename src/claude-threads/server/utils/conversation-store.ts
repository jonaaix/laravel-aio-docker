import { randomUUID } from 'node:crypto';
import { and, desc, eq, max } from 'drizzle-orm';
import { conversations, messages } from '../database/schema';
import type { ChatMessage, ConversationDetail, ConversationStatus, ConversationSummary } from '../../shared/types/conversation';

type ConversationRow = typeof conversations.$inferSelect;
type MessageRow = typeof messages.$inferSelect;

function toChatMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    role: row.role,
    parts: row.parts,
    metadata: { createdAt: row.createdAt },
  };
}

export function listConversations(): ConversationSummary[] {
  return useDatabase()
    .select()
    .from(conversations)
    .orderBy(desc(conversations.lastActivityAt))
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
  const rows = useDatabase()
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.seq)
    .all();
  return { ...summarize(row), messages: rows.map(toChatMessage) };
}

export function createConversation(title: string, workingDir: string): ConversationRow {
  const now = Date.now();
  const row: ConversationRow = {
    id: randomUUID(),
    title,
    status: 'paused',
    workingDir,
    agentSessionRef: randomUUID(),
    agentSessionStarted: false,
    createdAt: now,
    lastActivityAt: now,
  };
  useDatabase().insert(conversations).values(row).run();
  return row;
}

export function updateConversation(id: string, changes: Partial<Omit<ConversationRow, 'id'>>): void {
  useDatabase().update(conversations).set(changes).where(eq(conversations.id, id)).run();
}

export function setConversationStatus(id: string, status: ConversationStatus): void {
  updateConversation(id, { status, lastActivityAt: Date.now() });
}

export function appendMessage(conversationId: string, role: ChatMessage['role'], parts: ChatMessage['parts']): ChatMessage {
  const db = useDatabase();
  const next = db
    .select({ value: max(messages.seq) })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .get();
  const row: MessageRow = {
    id: randomUUID(),
    conversationId,
    seq: (next?.value ?? 0) + 1,
    role,
    parts,
    createdAt: Date.now(),
  };
  db.insert(messages).values(row).run();
  updateConversation(conversationId, { lastActivityAt: row.createdAt });
  return toChatMessage(row);
}

export function saveMessageParts(conversationId: string, messageId: string, parts: ChatMessage['parts']): void {
  useDatabase()
    .update(messages)
    .set({ parts })
    .where(and(eq(messages.id, messageId), eq(messages.conversationId, conversationId)))
    .run();
}

export function markRunningConversationsPaused(): void {
  useDatabase().update(conversations).set({ status: 'paused' }).where(eq(conversations.status, 'running')).run();
}
