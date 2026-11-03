import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { H3Event } from 'h3';
import type { UserRow } from './user-store';

export const SESSION_COOKIE = 'chat-session';
export const SIGN_IN_LIFETIME_S = 60;

export interface SignInParams {
    n: string;
    a: string;
    exp: string;
    nonce: string;
    sig: string;
}

export interface SignIn {
    name: string;
    avatarUrl: string | null;
}

function signature(key: string, message: string): string {
    return createHmac('sha256', key).update(message).digest('base64url');
}

function sameSecret(expected: string, given: string): boolean {
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    return a.length === b.length && timingSafeEqual(a, b);
}

function encodeText(value: string): string {
    return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeText(value: string): string | null {
    const decoded = Buffer.from(value, 'base64url').toString('utf8');
    return encodeText(decoded) === value ? decoded : null;
}

function signInMessage(params: Omit<SignInParams, 'sig'>): string {
    return ['sign-in', params.n, params.a, params.exp, params.nonce].join('|');
}

export function isChatKey(key: string, given: string): boolean {
    return key.length > 0 && sameSecret(key, given);
}

export function createSignInParams(key: string, signIn: SignIn, now = Date.now()): SignInParams {
    const params = {
        n: encodeText(signIn.name),
        a: signIn.avatarUrl ? encodeText(signIn.avatarUrl) : '',
        exp: String(Math.floor(now / 1000) + SIGN_IN_LIFETIME_S),
        nonce: randomBytes(16).toString('base64url'),
    };
    return { ...params, sig: signature(key, signInMessage(params)) };
}

export function createNonceLedger() {
    const used = new Map<string, number>();
    return {
        claim(nonce: string, expiresAtS: number, nowS: number): boolean {
            for (const [entry, until] of used) {
                if (until < nowS) {
                    used.delete(entry);
                }
            }
            if (used.has(nonce)) {
                return false;
            }
            used.set(nonce, expiresAtS);
            return true;
        },
    };
}

export type NonceLedger = ReturnType<typeof createNonceLedger>;

export function redeemSignIn(key: string, params: Partial<Record<keyof SignInParams, unknown>>, ledger: NonceLedger, now = Date.now()): SignIn | null {
    const { n, a = '', exp, nonce, sig } = params;
    if (!key || typeof n !== 'string' || typeof a !== 'string' || typeof exp !== 'string' || typeof nonce !== 'string' || typeof sig !== 'string') {
        return null;
    }
    if (!sameSecret(signature(key, signInMessage({ n, a, exp, nonce })), sig)) {
        return null;
    }
    const expiresAtS = Number(exp);
    const nowS = Math.floor(now / 1000);
    if (!Number.isInteger(expiresAtS) || expiresAtS < nowS || !ledger.claim(nonce, expiresAtS, nowS)) {
        return null;
    }
    const name = decodeText(n);
    const avatarUrl = a ? decodeText(a) : null;
    return name && (a === '' || avatarUrl) ? { name, avatarUrl } : null;
}

export function createSessionValue(key: string, userId: string): string {
    return `${userId}.${signature(key, `session|${userId}`)}`;
}

export function sessionUserId(key: string, value: string | undefined): string | null {
    if (!key || !value) {
        return null;
    }
    const separator = value.lastIndexOf('.');
    const userId = value.slice(0, separator);
    return separator > 0 && sameSecret(createSessionValue(key, userId), value) ? userId : null;
}

export function chatKey(): string {
    return useRuntimeConfig().chatKey;
}

export function sessionUser(event: H3Event): UserRow {
    const user = event.context.user as UserRow | undefined;
    if (!user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
    return user;
}

export function ownUser(event: H3Event): UserRow {
    const user = sessionUser(event);
    if (getRouterParam(event, 'id') !== user.id) {
        throw createError({ statusCode: 403, statusMessage: 'Only your own profile can be changed' });
    }
    return user;
}
