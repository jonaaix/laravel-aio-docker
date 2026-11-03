const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function isAllowedOrigin(origin: string): boolean {
    return origin === new URL(useRuntimeConfig().public.hubUrl).origin || (import.meta.dev && LOCAL_ORIGIN.test(origin));
}

export default defineEventHandler((event) => {
    const path = getRequestURL(event).pathname;
    // The agents' tool endpoint stays same-origin; the rest of the API also serves the hub on its own address.
    if (!path.includes('/api/') || path.includes('/api/mcp/')) {
        return;
    }
    if (handleCors(event, { origin: isAllowedOrigin, methods: '*', allowHeaders: ['authorization', 'content-type'] })) {
        return '';
    }
});
