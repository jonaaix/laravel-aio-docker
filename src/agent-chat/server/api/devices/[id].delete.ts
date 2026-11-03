export default defineEventHandler((event) => {
    const user = sessionUser(event);
    if (!deleteDevice(getRouterParam(event, 'id')!, user.id)) {
        throw createError({ statusCode: 404, statusMessage: 'Device not found' });
    }
    publishConversationListEvent({ type: 'devices', userId: user.id });
    return { ok: true };
});
