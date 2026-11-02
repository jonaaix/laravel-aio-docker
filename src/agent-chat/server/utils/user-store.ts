import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { users } from '../database/schema';
import type { ChatUser } from '../../shared/types/user';

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
    const row: UserRow = { id: randomUUID(), name, avatarSeed: null, avatarFile: null, avatarSource: null, avatarUpdatedAt: null, colorMode: null, font: null, createdAt: Date.now() };
    useDatabase().insert(users).values(row).run();
    return announce(row);
}

export function renameUser(id: string, name: string): UserRow {
    const taken = useDatabase().select().from(users).where(eq(users.name, name)).get();
    if (taken && taken.id !== id) {
        throw createError({ statusCode: 409, statusMessage: 'This name is already taken' });
    }
    useDatabase().update(users).set({ name }).where(eq(users.id, id)).run();
    return announce(findUser(id)!);
}

export function setUserAppearance(row: UserRow, changes: Partial<Pick<UserRow, 'colorMode' | 'font'>>): UserRow {
    useDatabase().update(users).set(changes).where(eq(users.id, row.id)).run();
    return announce({ ...row, ...changes });
}

export function listUsers(): ChatUser[] {
    return useDatabase().select().from(users).all().map(toChatUser);
}

function announce(row: UserRow): UserRow {
    publishConversationListEvent({ type: 'user', user: toChatUser(row) });
    return row;
}

export function toChatUser(row: UserRow): ChatUser {
    return { id: row.id, name: row.name, avatarSeed: row.avatarSeed, avatarUrl: avatarUrl(row.avatarFile, row.avatarUpdatedAt), avatarLocked: row.avatarSource !== null, colorMode: row.colorMode, font: row.font };
}

function userAvatarBase(row: UserRow): string {
    return `user-${row.id}`;
}

function saveAvatar(row: UserRow, avatarFile: string | null, avatarSource: string | null): UserRow {
    const changes = { avatarFile, avatarSource, avatarUpdatedAt: Date.now() };
    useDatabase().update(users).set(changes).where(eq(users.id, row.id)).run();
    return announce({ ...row, ...changes });
}

export async function syncLinkedAvatar(row: UserRow, source: string): Promise<UserRow> {
    if (row.avatarSource === source && row.avatarFile) {
        return row;
    }
    const file = await downloadAvatar(source, userAvatarBase(row));
    return file ? saveAvatar(row, file, source) : row;
}

function assertAvatarEditable(row: UserRow): void {
    if (row.avatarSource !== null) {
        throw createError({ statusCode: 409, statusMessage: 'This picture is set by the app that opened the chat' });
    }
}

export function setAvatarSeed(row: UserRow, seed: string): UserRow {
    assertAvatarEditable(row);
    removeAvatar(userAvatarBase(row));
    const changes = { avatarSeed: seed, avatarFile: null, avatarUpdatedAt: Date.now() };
    useDatabase().update(users).set(changes).where(eq(users.id, row.id)).run();
    return announce({ ...row, ...changes });
}

export function setUploadedAvatar(row: UserRow, upload: AttachmentReference | null): UserRow {
    assertAvatarEditable(row);
    if (!upload) {
        removeAvatar(userAvatarBase(row));
        return saveAvatar(row, null, null);
    }
    return saveAvatar(row, storeUploadedAvatar(upload, userAvatarBase(row)), null);
}
