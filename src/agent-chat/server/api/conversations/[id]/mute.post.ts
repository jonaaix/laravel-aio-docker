export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!;
    const conversation = findConversation(id);
    if (!conversation) {
        throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
    }
    const { userId, muted } = await readBody<{ userId?: unknown; muted?: unknown }>(event);
    const user = findUser(userId);
    if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' });
    }
    if (!isMembershipFlag(muted)) {
        throw createError({ statusCode: 422, statusMessage: 'muted must be true or false' });
    }
    setConversationMuted(id, user.id, muted);
    const summary = summarize(conversation);
    publishConversationListEvent({ type: 'conversation', conversation: summary });
    return summary;
});
