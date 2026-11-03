import { joinURL } from 'ufo';
import type { ChatUser } from '#shared/types/user';

export interface HubServer {
    id: string;
    url: string;
    deviceId: string;
    privateKey: CryptoKey;
    label: string;
    addedAt: number;
}

export interface PendingPairing {
    serverUrl: string;
    code: string;
}

interface AccessToken {
    token: string;
    expiresAt: number;
    userId: string;
}

const ACTIVE_SERVER_KEY = 'orbit-active-server';
const REFRESH_MARGIN_MS = 2 * 60 * 1000;

export class DeviceRemovedError extends Error {}

export const hubMode = ref(false);
export const appBaseUrl = ref('/');
export const hubServers = ref<HubServer[]>([]);
export const activeServerId = ref<string | null>(null);
export const activeToken = ref<string | null>(null);
const tokens = new Map<string, AccessToken>();
let refreshTimer: ReturnType<typeof setTimeout> | undefined;

export const activeServer = computed(() => hubServers.value.find(server => server.id === activeServerId.value) ?? null);

export function serverApiUrl(server: HubServer, path: string): string {
    return joinURL(server.url, 'api', path);
}

function rememberActive(id: string | null): void {
    try {
        if (id) {
            localStorage.setItem(ACTIVE_SERVER_KEY, id);
        }
        else {
            localStorage.removeItem(ACTIVE_SERVER_KEY);
        }
    }
    catch {
        // Blocked storage only forgets the choice; the first server is used instead.
    }
}

function rememberedActive(): string | null {
    try {
        return localStorage.getItem(ACTIVE_SERVER_KEY);
    }
    catch {
        return null;
    }
}

export async function loadHubServers(preferredId?: string | null): Promise<void> {
    hubServers.value = (await readAll<HubServer>(SERVERS_STORE)).sort((a, b) => a.addedAt - b.addedAt);
    const wanted = preferredId ?? rememberedActive();
    activeServerId.value = hubServers.value.find(server => server.id === wanted)?.id ?? hubServers.value[0]?.id ?? null;
    rememberActive(activeServerId.value);
}

export function readPairingLink(link: string): PendingPairing | null {
    try {
        const url = new URL(link.trim());
        const serverUrl = url.searchParams.get('pair');
        const code = url.searchParams.get('code');
        return serverUrl && code && /^https?:\/\//.test(serverUrl) ? { serverUrl: serverUrl.endsWith('/') ? serverUrl : `${serverUrl}/`, code } : null;
    }
    catch {
        return null;
    }
}

export function takePendingPairing(): PendingPairing | null {
    const pairing = readPairingLink(window.location.href);
    if (pairing) {
        const url = new URL(window.location.href);
        url.searchParams.delete('pair');
        url.searchParams.delete('code');
        window.history.replaceState(window.history.state, '', url);
    }
    return pairing;
}

export function takeRequestedServer(): string | null {
    const url = new URL(window.location.href);
    const requested = url.searchParams.get('server');
    if (requested) {
        url.searchParams.delete('server');
        window.history.replaceState(window.history.state, '', url);
    }
    return requested;
}

function deviceLabel(): string {
    const agent = navigator.userAgent;
    const device = /iPhone/.test(agent) ? 'iPhone' : /iPad/.test(agent) ? 'iPad' : /Android/.test(agent) ? 'Android' : /Mac/.test(agent) ? 'Mac' : /Windows/.test(agent) ? 'Windows' : /Linux/.test(agent) ? 'Linux' : 'Device';
    const browser = /Edg\//.test(agent) ? 'Edge' : /Firefox\//.test(agent) ? 'Firefox' : /Chrome\//.test(agent) ? 'Chrome' : /Safari\//.test(agent) ? 'Safari' : '';
    return browser ? `${device} · ${browser}` : device;
}

export async function pairServer(pairing: PendingPairing): Promise<HubServer> {
    const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', keys.publicKey);
    const { deviceId } = await $fetch<{ deviceId: string }>(joinURL(pairing.serverUrl, 'api/devices'), {
        method: 'POST',
        body: { code: pairing.code, publicKey: { kty, crv, x, y }, label: deviceLabel() },
    });
    const server: HubServer = { id: crypto.randomUUID(), url: pairing.serverUrl, deviceId, privateKey: keys.privateKey, label: new URL(pairing.serverUrl).host, addedAt: Date.now() };
    for (const existing of hubServers.value.filter(candidate => candidate.url === server.url)) {
        await deleteOne(SERVERS_STORE, existing.id);
    }
    await writeOne(SERVERS_STORE, server);
    return server;
}

export async function forgetServer(id: string): Promise<void> {
    tokens.delete(id);
    await deleteOne(SERVERS_STORE, id);
    if (activeServerId.value === id) {
        rememberActive(null);
    }
}

export function switchServer(id: string, path = '/'): void {
    rememberActive(id);
    const url = new URL(window.location.href);
    url.hash = `#${path}`;
    window.history.replaceState(null, '', url);
    window.location.reload();
}

async function requestToken(server: HubServer): Promise<Omit<AccessToken, 'userId'> & { user: ChatUser }> {
    let challenge: string;
    try {
        ({ challenge } = await $fetch<{ challenge: string }>(serverApiUrl(server, 'devices/challenge'), { method: 'POST', body: { deviceId: server.deviceId } }));
    }
    catch (failure) {
        if ((failure as { statusCode?: number }).statusCode === 401) {
            throw new DeviceRemovedError(server.label);
        }
        throw failure;
    }
    const signed = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, server.privateKey, new TextEncoder().encode(challenge));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signed))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    try {
        return await $fetch<Omit<AccessToken, 'userId'> & { user: ChatUser }>(serverApiUrl(server, 'devices/token'), { method: 'POST', body: { deviceId: server.deviceId, challenge, signature } });
    }
    catch (failure) {
        if ((failure as { statusCode?: number }).statusCode === 401) {
            throw new DeviceRemovedError(server.label);
        }
        throw failure;
    }
}

export async function accessToken(server: HubServer, fresh = false): Promise<string> {
    const cached = tokens.get(server.id);
    if (!fresh && cached && cached.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
        return cached.token;
    }
    const issued = await requestToken(server);
    tokens.set(server.id, { token: issued.token, expiresAt: issued.expiresAt, userId: issued.user.id });
    if (server.id === activeServerId.value) {
        activeToken.value = issued.token;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => void accessToken(server, true).catch(() => undefined), issued.expiresAt - REFRESH_MARGIN_MS - Date.now());
    }
    return issued.token;
}

export function serverUserId(serverId: string): string | null {
    return tokens.get(serverId)?.userId ?? null;
}
