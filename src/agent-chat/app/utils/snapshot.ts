interface StoredSnapshot<T> {
    key: string;
    value: T;
}

function snapshotKey(name: string): string {
    return `snapshot:${hubMode.value ? activeServerId.value ?? 'none' : 'local'}:${name}`;
}

export async function readSnapshot<T>(name: string): Promise<T | undefined> {
    try {
        return (await readOne<StoredSnapshot<T>>(CACHE_STORE, snapshotKey(name)))?.value;
    }
    catch {
        return undefined;
    }
}

export function writeSnapshot(name: string, value: unknown): void {
    void writeOne(CACHE_STORE, { key: snapshotKey(name), value: JSON.parse(JSON.stringify(value)) }).catch(() => undefined);
}

export async function loadWithSnapshot<T>(name: string, fetch: () => Promise<T>, apply: (value: T) => void): Promise<void> {
    let arrived = false;
    const fresh = fetch().then((value) => {
        arrived = true;
        apply(value);
        writeSnapshot(name, value);
    });
    const stored = await readSnapshot<T>(name);
    if (stored === undefined || arrived) {
        return fresh;
    }
    apply(stored);
    fresh.catch(() => undefined);
}
