const OPEN_PATHS = ['/api/auth/links', '/api/auth/session', '/api/mcp/'];

export default defineEventHandler((event) => {
    const path = getRequestURL(event).pathname;
    if (event.method === 'OPTIONS' || !path.includes('/api/') || OPEN_PATHS.some(open => path.includes(open))) {
        return;
    }
    const userId = sessionUserId(chatKey(), getCookie(event, SESSION_COOKIE));
    const user = userId ? findUser(userId) : null;
    if (!user) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
    event.context.user = user;
});
