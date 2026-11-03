export default defineEventHandler(async (event) => {
    const { userId, endpoint } = await readBody<{ userId?: unknown; endpoint?: unknown }>(event);
    if (typeof userId !== 'string' || typeof endpoint !== 'string' || endpoint.length > MAX_ENDPOINT_LENGTH) {
        throw createError({ statusCode: 422, statusMessage: 'User and endpoint are required' });
    }
    removePushSubscription(endpoint, userId);
    return { ok: true };
});
