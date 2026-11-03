export default defineEventHandler(async (event) => {
    const { userId, endpoint } = await readBody<{ userId?: unknown; endpoint?: unknown }>(event);
    const user = findUser(userId);
    if (!user || !isPushEndpoint(endpoint, import.meta.dev)) {
        throw createError({ statusCode: 422, statusMessage: 'User and endpoint are required' });
    }
    removePushSubscription(endpoint, user.id);
    return { ok: true };
});
