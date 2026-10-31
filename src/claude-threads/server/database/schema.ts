import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
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
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  seq: integer('seq').notNull(),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  parts: text('parts', { mode: 'json' }).$type<ChatMessage['parts']>().notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [
  index('messages_conversation_seq_idx').on(table.conversationId, table.seq),
]);
