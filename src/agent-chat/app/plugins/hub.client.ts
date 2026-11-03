export default defineNuxtPlugin(() => {
    const config = useRuntimeConfig();
    if (config.public.hub !== true) {
        return;
    }
    void registerHubWorker(config.app.baseURL).catch(() => undefined);
    const report = () => void reportPresence(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', report);
    window.addEventListener('pagehide', () => void reportPresence(false));
    watch(activeToken, (token, previous) => {
        if (token && !previous) {
            report();
        }
    });
});
