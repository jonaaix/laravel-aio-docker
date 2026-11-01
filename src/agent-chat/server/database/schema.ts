import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { ChatMessage } from '../../shared/types/conversation';

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  status: text('status', { enum: ['running', 'paused'] }).notNull().default('paused'),
  workingDir: text('working_dir').notNull(),
  agentSessionRef: text('agent_session_ref').notNull(),
  agentSessionStarted: integer('agent_session_started', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
  lastActivityAt: integer('last_activity_at').notNull(),
  archivedAt: integer('archived_at'),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  parts: text('parts', { mode: 'json' }).$type<ChatMessage['parts']>().notNull(),
  createdAt: integer('created_at').notNull(),
  model: text('model'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cacheReadTokens: integer('cache_read_tokens'),
  cacheCreationTokens: integer('cache_creation_tokens'),
  costUsd: real('cost_usd'),
  durationMs: integer('duration_ms'),
  outcome: text('outcome', { enum: ['completed', 'stopped', 'failed'] }),
}, table => [
  index('messages_conversation_seq_idx').on(table.conversationId, table.seq),
]);
