import { and, count, eq, gt, ne, or, sql } from 'drizzle-orm';
import { conversationReads, conversations, messages } from '../database/schema';

export type ReadMap = Record<string, number>;
export type UnreadCounts = Record<string, number>;

function baseline(userId: string): ReadMap {
    const rows = useDatabase()
        .select({ conversationId: conversations.id, seenAnswerAt: conversations.lastPostedAt })
        .from(conversations)
        .all()
        .map(row => ({ conversationId: row.conversationId, userId, seenAnswerAt: row.seenAnswerAt ?? 0 }));
    if (rows.length > 0) {
        useDatabase().insert(conversationReads).values(rows).run();
    }
    return Object.fromEntries(rows.map(row => [row.conversationId, row.seenAnswerAt]));
}

export function readsFor(userId: string): ReadMap {
    const rows = useDatabase().select().from(conversationReads).where(eq(conversationReads.userId, userId)).all();
    return rows.length === 0 ? baseline(userId) : Object.fromEntries(rows.map(row => [row.conversationId, row.seenAnswerAt]));
}

export function markRead(userId: string, conversationId: string, seenAnswerAt: number): number {
    const db = useDatabase();
    const current = db.select().from(conversationReads)
        .where(and(eq(conversationReads.conversationId, conversationId), eq(conversationReads.userId, userId)))
        .get();
    const latest = Math.max(current?.seenAnswerAt ?? 0, seenAnswerAt);
    db.insert(conversationReads)
        .values({ conversationId, userId, seenAnswerAt: latest })
        .onConflictDoUpdate({ target: [conversationReads.conversationId, conversationReads.userId], set: { seenAnswerAt: latest } })
        .run();
    return latest;
}

export function unreadCountsFor(userId: string): UnreadCounts {
    readsFor(userId);
    const rows = useDatabase()
        .select({ conversationId: messages.conversationId, unread: count() })
        .from(messages)
        .leftJoin(conversationReads, and(eq(conversationReads.conversationId, messages.conversationId), eq(conversationReads.userId, userId)))
        .where(and(
            gt(messages.postedAt, sql`coalesce(${conversationReads.seenAnswerAt}, 0)`),
            or(eq(messages.role, 'assistant'), and(eq(messages.role, 'user'), ne(sql`coalesce(${messages.senderId}, '')`, userId))),
        ))
        .groupBy(messages.conversationId)
        .all();
    return Object.fromEntries(rows.map(row => [row.conversationId, row.unread]));
}
