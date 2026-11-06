const IDLE_RELOAD_MS = 60_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

export default defineNuxtPlugin((nuxtApp) => {
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    function reloadWhenIdle(): void {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => reloadNuxtApp(), IDLE_RELOAD_MS);
    }

    nuxtApp.hooks.hookOnce('app:manifest:update', () => {
        useRouter().beforeEach((to) => {
            reloadNuxtApp({ path: to.fullPath });
            return false;
        });
        for (const event of ACTIVITY_EVENTS) {
            window.addEventListener(event, reloadWhenIdle, { passive: true });
        }
        reloadWhenIdle();
    });
});
