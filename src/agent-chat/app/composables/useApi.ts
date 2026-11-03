import { joinURL } from 'ufo';

const RECONNECT_DELAY_MS = 2000;
const RECONNECT_DELAY_MAX_MS = 60_000;
const UNAUTHORIZED = 401;

export const hubOffline = ref(false);

interface CachedResponse {
    key: string;
    value: unknown;
}

function isNetworkFailure(failure: unknown): boolean {
    return !(failure instanceof DeviceRemovedError) && (failure as { statusCode?: number }).statusCode === undefined;
}

export function apiUrl(path: string): string {
    const server = hubMode.value ? activeServer.value : null;
    if (!server) {
        return joinURL(appBaseUrl.value, 'api', path);
    }
    const url = new URL(serverApiUrl(server, path));
    if (activeToken.value) {
        url.searchParams.set('access_token', activeToken.value);
    }
    return url.toString();
}

export async function apiFetch<T>(path: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    const server = hubMode.value ? activeServer.value : null;
    if (!server) {
        return $fetch<T>(apiUrl(path), options as never) as Promise<T>;
    }
    const send = async (fresh: boolean) => $fetch<T>(serverApiUrl(server, path), {
        ...options,
        headers: { ...(options.headers as Record<string, string> | undefined), authorization: `Bearer ${await accessToken(server, fresh)}` },
    } as never) as Promise<T>;
    const method = (options.method ?? 'GET').toString().toUpperCase();
    const cacheKey = method === 'GET' ? `${server.id}|${path}|${JSON.stringify(options.query ?? {})}` : null;
    try {
        let result: T;
        try {
            result = await send(false);
        }
        catch (failure) {
            if ((failure as { statusCode?: number }).statusCode !== UNAUTHORIZED) {
                throw failure;
            }
            result = await send(true);
        }
        hubOffline.value = false;
        if (cacheKey) {
            void writeOne(CACHE_STORE, { key: cacheKey, value: result }).catch(() => undefined);
        }
        return result;
    }
    catch (failure) {
        const cached = cacheKey && isNetworkFailure(failure) ? await readOne<CachedResponse>(CACHE_STORE, cacheKey).catch(() => undefined) : undefined;
        if (!cached) {
            throw failure;
        }
        hubOffline.value = true;
        return cached.value as T;
    }
}

export function subscribeEvents<T>(path: string, onEvent: (event: T) => void, onReconnect?: () => void): () => void {
    let source: EventSource | null = null;
    let closed = false;
    let opened = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let delay = RECONNECT_DELAY_MS;

    async function connect(): Promise<void> {
        const server = hubMode.value ? activeServer.value : null;
        if (server) {
            await accessToken(server).catch(() => undefined);
        }
        if (closed) {
            return;
        }
        source = new EventSource(apiUrl(path));
        source.onopen = () => {
            delay = RECONNECT_DELAY_MS;
            if (opened) {
                onReconnect?.();
            }
            opened = true;
        };
        source.onmessage = message => onEvent(JSON.parse(message.data) as T);
        source.onerror = () => {
            if (server && source?.readyState === EventSource.CLOSED) {
                source = null;
                retry = setTimeout(() => void connect(), delay);
                delay = Math.min(delay * 2, RECONNECT_DELAY_MAX_MS);
            }
        };
    }

    void connect();
    return () => {
        closed = true;
        clearTimeout(retry);
        source?.close();
    };
}
