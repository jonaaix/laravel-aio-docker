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

function userByRef(userRef: string): UserRow | undefined {
    return useDatabase().select().from(users).where(eq(users.appUserRef, userRef)).get();
}

function userByName(name: string): UserRow | undefined {
    return useDatabase().select().from(users).where(eq(users.name, name)).get();
}

export function isAppUserBlocked(userRef: string): boolean {
    return Boolean(userByRef(userRef)?.blockedAt);
}

export function isNameTakenByOther(name: string, userRef: string): boolean {
    const owner = userByName(name);
    if (!owner || owner.appUserRef === userRef) {
        return false;
    }
    return owner.appUserRef !== null || Boolean(userByRef(userRef));
}

function renameUser(row: UserRow, name: string): UserRow {
    useDatabase().update(users).set({ name }).where(eq(users.id, row.id)).run();
    return announce({ ...row, name });
}

export function signInUser(name: string, userRef: string): UserRow | null {
    if (isNameTakenByOther(name, userRef)) {
        return null;
    }
    const known = userByRef(userRef);
    if (known) {
        return known.name === name ? known : renameUser(known, name);
    }
    const named = userByName(name);
    if (named) {
        useDatabase().update(users).set({ appUserRef: userRef }).where(eq(users.id, named.id)).run();
        return { ...named, appUserRef: userRef };
    }
    const row: UserRow = { id: randomUUID(), name, avatarSeed: null, avatarFile: null, avatarSource: null, avatarUpdatedAt: null, colorMode: null, font: null, language: null, pinSentMessage: false, changesPanelHidden: false, changesPanelAuto: true, tint: null, speechRate: null, appUserRef: userRef, isAdmin: false, blockedAt: null, accountDetails: null, createdAt: Date.now() };
    useDatabase().insert(users).values(row).run();
    return announce(row);
}

export function setUserAppearance(row: UserRow, changes: Partial<Pick<UserRow, 'colorMode' | 'font' | 'language' | 'pinSentMessage' | 'changesPanelHidden' | 'changesPanelAuto' | 'tint' | 'speechRate'>>): UserRow {
    useDatabase().update(users).set(changes).where(eq(users.id, row.id)).run();
    return announce({ ...row, ...changes });
}

export function setUserAdmin(row: UserRow, isAdmin: boolean): UserRow {
    useDatabase().update(users).set({ isAdmin }).where(eq(users.id, row.id)).run();
    return announce({ ...row, isAdmin });
}

export function setUserBlocked(row: UserRow, blocked: boolean): UserRow {
    const changes = blocked ? { blockedAt: Date.now(), isAdmin: false } : { blockedAt: null };
    useDatabase().update(users).set(changes).where(eq(users.id, row.id)).run();
    const updated = announce({ ...row, ...changes });
    if (blocked) {
        publishUserBlocked(row.id);
    }
    return updated;
}

export function setUserAccountDetails(row: UserRow, accountDetails: UserRow['accountDetails']): UserRow {
    useDatabase().update(users).set({ accountDetails }).where(eq(users.id, row.id)).run();
    return announce({ ...row, accountDetails });
}

export function chatNameOf(id: unknown): string | null {
    return typeof id === 'string' ? chatNames(useDatabase().select({ id: users.id, name: users.name }).from(users).all())[id] ?? null : null;
}

export function listUsers(): ChatUser[] {
    return useDatabase().select().from(users).all().map(toChatUser);
}

function announce(row: UserRow): UserRow {
    publishConversationListEvent({ type: 'user', user: toChatUser(row) });
    return row;
}

export function toChatUser(row: UserRow): ChatUser {
    return { id: row.id, name: row.name, avatarSeed: row.avatarSeed, avatarUrl: avatarUrl(row.avatarFile, row.avatarUpdatedAt), avatarLocked: row.avatarSource !== null, colorMode: row.colorMode, font: row.font, language: row.language, pinSentMessage: row.pinSentMessage, changesPanelHidden: row.changesPanelHidden, changesPanelAuto: row.changesPanelAuto, tint: row.tint, speechRate: row.speechRate, admin: row.isAdmin, blocked: row.blockedAt !== null, accountDetails: row.accountDetails };
}

function userAvatarBase(row: UserRow): string {
    return `user-${row.id}`;
}

function saveAvatar(row: UserRow, avatarFile: string | null, avatarSource: string | null): UserRow {
    const changes = { avatarFile, avatarSource, avatarUpdatedAt: Date.now() };
    useDatabase().update(users).set(changes).where(eq(users.id, row.id)).run();
    return announce({ ...row, ...changes });
}

export async function syncLinkedAvatar(row: UserRow, source: string | null): Promise<UserRow> {
    if (!source) {
        if (row.avatarSource === null) {
            return row;
        }
        removeAvatar(userAvatarBase(row));
        return saveAvatar(row, null, null);
    }
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
