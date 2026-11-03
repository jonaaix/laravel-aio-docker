import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { ChatMessage } from '../../shared/types/conversation';

export interface AnnouncedAgent {
    id: string;
    name: string;
}

export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    avatarSeed: text('avatar_seed'),
    avatarFile: text('avatar_file'),
    avatarSource: text('avatar_source'),
    avatarUpdatedAt: integer('avatar_updated_at'),
    colorMode: text('color_mode', { enum: ['light', 'dark', 'system'] }),
    font: text('font'),
    language: text('language'),
    pinSentMessage: integer('pin_sent_message', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('users_name_unique').on(table.name)]);

export const agents = sqliteTable('agents', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    role: text('role').notNull().default(''),
    model: text('model'),
    effort: text('effort'),
    lead: integer('lead', { mode: 'boolean' }).notNull().default(false),
    instructions: text('instructions').notNull().default(''),
    avatarSeed: text('avatar_seed'),
    avatarFile: text('avatar_file'),
    avatarUpdatedAt: integer('avatar_updated_at'),
    createdAt: integer('created_at').notNull(),
}, table => [uniqueIndex('agents_name_unique').on(table.name)]);

export const conversations = sqliteTable('conversations', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    titleRenamed: integer('title_renamed', { mode: 'boolean' }).notNull().default(false),
    creatorId: text('creator_id').references(() => users.id),
    status: text('status', { enum: ['running', 'paused'] }).notNull().default('paused'),
    workingDir: text('working_dir').notNull(),
    agentSessionRef: text('agent_session_ref').notNull(),
    agentSessionStarted: integer('agent_session_started', { mode: 'boolean' }).notNull().default(false),
    announcedAgents: text('announced_agents', { mode: 'json' }).$type<AnnouncedAgent[]>().notNull().default([]),
    createdAt: integer('created_at').notNull(),
    lastActivityAt: integer('last_activity_at').notNull(),
    lastAnswerAt: integer('last_answer_at'),
    archivedAt: integer('archived_at'),
});

export const conversationAgents = sqliteTable('conversation_agents', {
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
    addedAt: integer('added_at').notNull(),
    sessionRef: text('session_ref'),
    sessionStarted: integer('session_started', { mode: 'boolean' }).notNull().default(false),
    announcedAgents: text('announced_agents', { mode: 'json' }).$type<AnnouncedAgent[]>().notNull().default([]),
}, table => [primaryKey({ columns: [table.conversationId, table.agentId] })]);

export const messages = sqliteTable('messages', {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
    parts: text('parts', { mode: 'json' }).$type<ChatMessage['parts']>().notNull(),
    senderId: text('sender_id').references(() => users.id),
    // The database column lacks this delete rule (added by ALTER TABLE), so deleteAgent clears it first.
    agentId: text('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    createdAt: integer('created_at').notNull(),
    model: text('model'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cacheReadTokens: integer('cache_read_tokens'),
    cacheCreationTokens: integer('cache_creation_tokens'),
    costUsd: real('cost_usd'),
    durationMs: integer('duration_ms'),
    outcome: text('outcome', { enum: ['completed', 'stopped', 'failed'] }),
    errorMessage: text('error_message'),
}, table => [
    index('messages_conversation_seq_idx').on(table.conversationId, table.seq),
]);

export const pushSubscriptions = sqliteTable('push_subscriptions', {
    endpoint: text('endpoint').notNull(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    language: text('language'),
    createdAt: integer('created_at').notNull(),
}, table => [primaryKey({ columns: [table.endpoint, table.userId] })]);
