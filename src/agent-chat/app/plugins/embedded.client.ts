const ROUTE_KEY = 'chat-embedded-route';

function savedRoute(): string | null {
    try {
        return localStorage.getItem(ROUTE_KEY);
    }
    catch {
        return null;
    }
}

export default defineNuxtPlugin(() => {
    if (!isEmbedded()) {
        return;
    }
    const router = useRouter();
    let first = true;
    router.beforeEach((to) => {
        if (!first) {
            return;
        }
        first = false;
        const saved = savedRoute();
        return saved && saved !== '/' && to.path === '/' ? saved : undefined;
    });
    router.afterEach((to) => {
        try {
            localStorage.setItem(ROUTE_KEY, to.path);
        }
        catch {
            // Blocked storage only means the panel opens at the start page.
        }
    });
});
