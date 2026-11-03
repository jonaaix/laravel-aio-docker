export default defineEventHandler(async (event) => {
    const { userId, endpoint, visible } = await readBody<{ userId?: unknown; endpoint?: unknown; visible?: unknown }>(event);
    const user = findUser(userId);
    if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' });
    }
    if (!isPushEndpoint(endpoint, import.meta.dev) || typeof visible !== 'boolean') {
        throw createError({ statusCode: 422, statusMessage: 'Endpoint and visibility are required' });
    }
    setAppVisible(endpoint, user.id, visible);
    return { ok: true };
});
