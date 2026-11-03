export default defineEventHandler(async (event) => {
    const { endpoint, visible } = await readBody<{ endpoint?: unknown; visible?: unknown }>(event);
    const user = sessionUser(event);
    if (!isPushEndpoint(endpoint, import.meta.dev) || typeof visible !== 'boolean') {
        throw createError({ statusCode: 422, statusMessage: 'Endpoint and visibility are required' });
    }
    setAppVisible(endpoint, user.id, visible);
    return { ok: true };
});
