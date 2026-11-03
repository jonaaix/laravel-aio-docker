export default defineEventHandler(async (event) => {
    const { endpoint } = await readBody<{ endpoint?: unknown }>(event);
    const user = sessionUser(event);
    if (!isPushEndpoint(endpoint, import.meta.dev)) {
        throw createError({ statusCode: 422, statusMessage: 'A push endpoint is required' });
    }
    removePushSubscription(endpoint, user.id);
    return { ok: true };
});
