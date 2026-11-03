export const updateReady = ref(false);
let registration: ServiceWorkerRegistration | null = null;
let updating = false;

function watchForUpdate(found: ServiceWorkerRegistration): void {
    if (found.waiting && navigator.serviceWorker.controller) {
        updateReady.value = true;
    }
    found.addEventListener('updatefound', () => {
        const installing = found.installing;
        installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                updateReady.value = true;
            }
        });
    });
}

export async function registerHubWorker(baseUrl: string): Promise<void> {
    if (!('serviceWorker' in navigator)) {
        return;
    }
    registration = await navigator.serviceWorker.register(`${baseUrl}sw.js`, { scope: baseUrl });
    watchForUpdate(registration);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (updating) {
            window.location.reload();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            void registration?.update().catch(() => undefined);
        }
    });
}

export function applyUpdate(): void {
    updating = true;
    registration?.waiting?.postMessage({ type: 'skip-waiting' });
}
