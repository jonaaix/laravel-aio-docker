export const MAX_ENDPOINT_LENGTH = 1024;
export const MAX_KEY_LENGTH = 256;
export const MAX_SUBSCRIPTIONS_PER_USER = 10;

const PUSH_HOSTS = ['fcm.googleapis.com', 'push.apple.com', 'push.services.mozilla.com', 'notify.windows.com'];
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

function belongsTo(host: string, domain: string): boolean {
    return host === domain || host.endsWith(`.${domain}`);
}

export function isPushEndpoint(endpoint: unknown, allowLoopback = false): endpoint is string {
    if (typeof endpoint !== 'string' || endpoint.length > MAX_ENDPOINT_LENGTH) {
        return false;
    }
    let url: URL;
    try {
        url = new URL(endpoint);
    }
    catch {
        return false;
    }
    if (url.protocol !== 'https:' || url.username || url.password) {
        return false;
    }
    return PUSH_HOSTS.some(domain => belongsTo(url.hostname, domain)) || (allowLoopback && LOOPBACK_HOSTS.includes(url.hostname));
}

export function isShortToken(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0 && value.length <= MAX_KEY_LENGTH;
}

const VAPID_PUBLIC_KEY_BYTES = 65;
const VAPID_PRIVATE_KEY_BYTES = 32;
const UNCOMPRESSED_POINT = 0x04;
const HUB_REF = /^[A-Za-z0-9-]{1,64}$/;

function base64UrlBytes(value: unknown): Buffer | null {
    return typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) ? Buffer.from(value, 'base64url') : null;
}

export function isVapidKeyPair(value: unknown): value is { publicKey: string; privateKey: string } {
    const pair = value as { publicKey?: unknown; privateKey?: unknown } | null | undefined;
    const point = base64UrlBytes(pair?.publicKey);
    const secret = base64UrlBytes(pair?.privateKey);
    return point?.length === VAPID_PUBLIC_KEY_BYTES && point[0] === UNCOMPRESSED_POINT && secret?.length === VAPID_PRIVATE_KEY_BYTES;
}

export function isHubRef(value: unknown): value is string {
    return typeof value === 'string' && HUB_REF.test(value);
}
