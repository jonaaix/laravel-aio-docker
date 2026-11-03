const DB_NAME = 'orbit';
const DB_VERSION = 1;
export const SERVERS_STORE = 'servers';
export const CACHE_STORE = 'cache';
export const KEYS_STORE = 'keys';

let opening: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
    opening ??= new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(SERVERS_STORE, { keyPath: 'id' });
            request.result.createObjectStore(CACHE_STORE, { keyPath: 'key' });
            request.result.createObjectStore(KEYS_STORE, { keyPath: 'name' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return opening;
}

function settle<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function readAll<T>(store: string): Promise<T[]> {
    return settle((await database()).transaction(store).objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function readOne<T>(store: string, key: string): Promise<T | undefined> {
    return settle((await database()).transaction(store).objectStore(store).get(key) as IDBRequest<T | undefined>);
}

export async function writeOne(store: string, value: unknown): Promise<void> {
    await settle((await database()).transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function deleteOne(store: string, key: string): Promise<void> {
    await settle((await database()).transaction(store, 'readwrite').objectStore(store).delete(key));
}
