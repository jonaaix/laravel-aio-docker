const TITLE_MAX_LENGTH = 120;

export default defineEventHandler(async (event) => {
    const { title } = await readBody<{ title?: unknown }>(event);
    const trimmed = typeof title === 'string' ? title.trim() : '';
    if (!trimmed || trimmed.length > TITLE_MAX_LENGTH) {
        throw createError({ statusCode: 422, statusMessage: `Title must be 1 to ${TITLE_MAX_LENGTH} characters` });
    }
    const id = getRouterParam(event, 'id')!;
    const conversation = findConversation(id);
    if (!conversation) {
        throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
    }
    if (conversation.archivedAt !== null) {
        throw createError({ statusCode: 409, statusMessage: 'Conversation is archived' });
    }
    useConversationRuntime(id).rename(trimmed);
    return summarize(findConversation(id)!);
});
