export default defineEventHandler((event) => {
    const path = getRequestURL(event).pathname;
    // The agents' tool endpoint stays same-origin; everything else serves the mobile app from any origin.
    if (!path.includes('/api/') || path.includes('/api/mcp/')) {
        return;
    }
    if (handleCors(event, { origin: '*', methods: '*', allowHeaders: '*' })) {
        return '';
    }
});
