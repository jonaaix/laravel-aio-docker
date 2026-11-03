interface DeviceVapidKeys {
    name: 'vapid';
    publicKey: string;
    privateKey: string;
}

export type PushSupport = 'ready' | 'install' | 'unsupported';

function base64Url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), character => character.charCodeAt(0));
}

export function pushSupport(): PushSupport {
    const appleMobile = /iPhone|iPad/.test(navigator.userAgent);
    const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
        return 'ready';
    }
    return appleMobile && !installed ? 'install' : 'unsupported';
}

async function deviceVapidKeys(): Promise<DeviceVapidKeys> {
    const stored = await readOne<DeviceVapidKeys>(KEYS_STORE, 'vapid');
    if (stored) {
        return stored;
    }
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const point = new Uint8Array([4, ...fromBase64Url(jwk.x!), ...fromBase64Url(jwk.y!)]);
    const keys: DeviceVapidKeys = { name: 'vapid', publicKey: base64Url(point), privateKey: jwk.d! };
    await writeOne(KEYS_STORE, keys);
    return keys;
}

async function deviceSubscription(publicKey: string): Promise<PushSubscription> {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const existingKey = existing?.options.applicationServerKey;
    if (existing && existingKey && base64Url(new Uint8Array(existingKey)) === publicKey) {
        return existing;
    }
    await existing?.unsubscribe();
    return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(publicKey) });
}

export async function currentEndpoint(): Promise<string | null> {
    if (pushSupport() !== 'ready') {
        return null;
    }
    const registration = await navigator.serviceWorker.ready;
    return (await registration.pushManager.getSubscription())?.endpoint ?? null;
}

export async function enableServerPush(server: HubServer, language: string): Promise<void> {
    if (await Notification.requestPermission() !== 'granted') {
        throw new Error('denied');
    }
    const vapid = await deviceVapidKeys();
    const subscription = await deviceSubscription(vapid.publicKey);
    await apiFetch('push/subscriptions', { method: 'POST', body: { subscription: subscription.toJSON(), language, vapid, hubRef: server.id } });
}

export async function disableServerPush(): Promise<void> {
    const endpoint = await currentEndpoint();
    if (endpoint) {
        await apiFetch('push/subscriptions', { method: 'DELETE', body: { endpoint } });
    }
}

export async function serverPushEnabled(): Promise<boolean> {
    const endpoint = await currentEndpoint();
    return endpoint ? (await apiFetch<{ enabled: boolean }>('push/subscriptions', { query: { endpoint } })).enabled : false;
}

export async function reportPresence(visible: boolean): Promise<void> {
    const endpoint = await currentEndpoint();
    if (endpoint) {
        await apiFetch('push/presence', { method: 'POST', body: { endpoint, visible } }).catch(() => undefined);
    }
}
