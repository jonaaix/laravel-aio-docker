import { createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto';

export const PAIRING_CODE_LIFETIME_MS = 10 * 60 * 1000;
export const CHALLENGE_LIFETIME_MS = 60 * 1000;
export const ACCESS_TOKEN_LIFETIME_MS = 15 * 60 * 1000;

export interface DevicePublicKey {
    kty: 'EC';
    crv: 'P-256';
    x: string;
    y: string;
}

function randomCode(): string {
    return randomBytes(24).toString('base64url');
}

function createExpiringLedger<T>() {
    const entries = new Map<string, { value: T; expiresAt: number }>();
    return {
        put(key: string, value: T, expiresAt: number): void {
            entries.set(key, { value, expiresAt });
        },
        take(key: string, now: number): T | null {
            for (const [entry, { expiresAt }] of entries) {
                if (expiresAt < now) {
                    entries.delete(entry);
                }
            }
            const found = entries.get(key);
            entries.delete(key);
            return found ? found.value : null;
        },
    };
}

export function createPairingCodes() {
    const ledger = createExpiringLedger<string>();
    return {
        issue(userId: string, now = Date.now()): { code: string; expiresAt: number } {
            const code = randomCode();
            const expiresAt = now + PAIRING_CODE_LIFETIME_MS;
            ledger.put(code, userId, expiresAt);
            return { code, expiresAt };
        },
        claim(code: unknown, now = Date.now()): string | null {
            return typeof code === 'string' ? ledger.take(code, now) : null;
        },
    };
}

export function createChallenges() {
    const ledger = createExpiringLedger<string>();
    return {
        issue(deviceId: string, now = Date.now()): string {
            const challenge = randomCode();
            ledger.put(challenge, deviceId, now + CHALLENGE_LIFETIME_MS);
            return challenge;
        },
        consume(challenge: unknown, deviceId: string, now = Date.now()): boolean {
            return typeof challenge === 'string' && ledger.take(challenge, now) === deviceId;
        },
    };
}

export function readDevicePublicKey(value: unknown): DevicePublicKey | null {
    const key = value as Partial<Record<string, unknown>> | null;
    if (!key || typeof key !== 'object' || key.kty !== 'EC' || key.crv !== 'P-256' || typeof key.x !== 'string' || typeof key.y !== 'string' || 'd' in key) {
        return null;
    }
    const publicKey = { kty: 'EC' as const, crv: 'P-256' as const, x: key.x, y: key.y };
    try {
        createPublicKey({ key: publicKey, format: 'jwk' });
        return publicKey;
    }
    catch {
        return null;
    }
}

export function isDeviceSignature(publicKey: DevicePublicKey, challenge: string, signature: unknown): boolean {
    if (typeof signature !== 'string') {
        return false;
    }
    try {
        const key = createPublicKey({ key: publicKey, format: 'jwk' });
        return verify('sha256', Buffer.from(challenge), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'));
    }
    catch {
        return false;
    }
}

function tokenSignature(key: string, deviceId: string, expiresAt: number): string {
    return createHmac('sha256', key).update(`device|${deviceId}|${expiresAt}`).digest('base64url');
}

export function createAccessToken(key: string, deviceId: string, now = Date.now()): { token: string; expiresAt: number } {
    const expiresAt = now + ACCESS_TOKEN_LIFETIME_MS;
    return { token: `${deviceId}.${expiresAt}.${tokenSignature(key, deviceId, expiresAt)}`, expiresAt };
}

export function accessTokenDeviceId(key: string, token: string | undefined, now = Date.now()): string | null {
    const [deviceId, expires, signature] = (token ?? '').split('.');
    const expiresAt = Number(expires);
    if (!key || !deviceId || !signature || !Number.isInteger(expiresAt) || expiresAt < now) {
        return null;
    }
    const expected = Buffer.from(tokenSignature(key, deviceId, expiresAt));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given) ? deviceId : null;
}
