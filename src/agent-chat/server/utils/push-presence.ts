const PRESENCE_TTL_MS = 50_000;
const MAX_ENTRIES = 2000;

const visibleUntil = new Map<string, number>();

function key(endpoint: string, userId: string): string {
    return `${userId}|${endpoint}`;
}

export function setAppVisible(endpoint: string, userId: string, visible: boolean, now = Date.now()): void {
    if (visible) {
        visibleUntil.delete(key(endpoint, userId));
        visibleUntil.set(key(endpoint, userId), now + PRESENCE_TTL_MS);
    }
    else {
        visibleUntil.delete(key(endpoint, userId));
    }
    for (const [entry, until] of visibleUntil) {
        if (until <= now) {
            visibleUntil.delete(entry);
        }
    }
    for (const oldest of visibleUntil.keys()) {
        if (visibleUntil.size <= MAX_ENTRIES) {
            break;
        }
        visibleUntil.delete(oldest);
    }
}

export function isAppVisible(endpoint: string, userId: string, now = Date.now()): boolean {
    return (visibleUntil.get(key(endpoint, userId)) ?? 0) > now;
}
