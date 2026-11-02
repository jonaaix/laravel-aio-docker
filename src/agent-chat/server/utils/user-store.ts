import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { users } from '../database/schema';

export type UserRow = typeof users.$inferSelect;

export function findUser(id: unknown): UserRow | null {
    if (typeof id !== 'string' || !id) {
        return null;
    }
    return useDatabase().select().from(users).where(eq(users.id, id)).get() ?? null;
}

export function findOrCreateUser(name: string): UserRow {
    const existing = useDatabase().select().from(users).where(eq(users.name, name)).get();
    if (existing) {
        return existing;
    }
    const row: UserRow = { id: randomUUID(), name, createdAt: Date.now() };
    useDatabase().insert(users).values(row).run();
    return row;
}

export function renameUser(id: string, name: string): UserRow {
    const taken = useDatabase().select().from(users).where(eq(users.name, name)).get();
    if (taken && taken.id !== id) {
        throw createError({ statusCode: 409, statusMessage: 'This name is already taken' });
    }
    useDatabase().update(users).set({ name }).where(eq(users.id, id)).run();
    return findUser(id)!;
}
