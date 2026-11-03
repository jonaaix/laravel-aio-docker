export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!;
    const conversation = findConversation(id);
    if (!conversation) {
        throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
    }
    const { muted } = await readBody<{ muted?: unknown }>(event);
    const user = sessionUser(event);
    if (!isMembershipFlag(muted)) {
        throw createError({ statusCode: 422, statusMessage: 'muted must be true or false' });
    }
    setConversationMuted(id, user.id, muted);
    const summary = summarize(conversation);
    publishConversationListEvent({ type: 'conversation', conversation: summary });
    return summary;
});
