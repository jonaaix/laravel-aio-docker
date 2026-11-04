export default defineEventHandler((event) => {
    const limit = Number(getQuery(event).limit);
    const detail = getConversationDetail(getRouterParam(event, 'id')!, Number.isFinite(limit) ? limit : undefined);
    if (!detail) {
        throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
    }
    return detail;
});
