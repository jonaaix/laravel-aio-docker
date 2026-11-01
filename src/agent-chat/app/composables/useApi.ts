import { joinURL } from 'ufo';

export function apiUrl(path: string): string {
    return joinURL(useRuntimeConfig().app.baseURL, 'api', path);
}

export function apiFetch<T>(path: string, options: Parameters<typeof $fetch>[1] = {}): Promise<T> {
    return $fetch<T>(apiUrl(path), options as never) as Promise<T>;
}

export function subscribeEvents<T>(path: string, onEvent: (event: T) => void, onReconnect?: () => void): () => void {
    const source = new EventSource(apiUrl(path));
    let opened = false;
    source.onopen = () => {
        if (opened) {
            onReconnect?.();
        }
        opened = true;
    };
    source.onmessage = message => onEvent(JSON.parse(message.data) as T);
    return () => source.close();
}
