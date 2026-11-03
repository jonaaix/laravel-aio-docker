export default defineEventHandler(async (event) => {
    const { userId, endpoint, visible } = await readBody<{ userId?: unknown; endpoint?: unknown; visible?: unknown }>(event);
    if (typeof userId !== 'string' || typeof endpoint !== 'string' || typeof visible !== 'boolean') {
        throw createError({ statusCode: 422, statusMessage: 'User, endpoint and visibility are required' });
    }
    setAppVisible(endpoint, userId, visible);
    return { ok: true };
});
