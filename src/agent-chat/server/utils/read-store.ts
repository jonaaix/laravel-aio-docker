import { and, eq } from 'drizzle-orm';
import { conversationReads, conversations } from '../database/schema';

export type ReadMap = Record<string, number>;

function baseline(userId: string): ReadMap {
    const rows = useDatabase()
        .select({ conversationId: conversations.id, seenAnswerAt: conversations.lastAnswerAt })
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
