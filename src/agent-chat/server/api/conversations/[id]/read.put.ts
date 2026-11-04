export default defineEventHandler(async (event) => {
    const user = sessionUser(event);
    const conversationId = getRouterParam(event, 'id')!;
    if (!findConversation(conversationId)) {
        throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
    }
    const { seenAnswerAt } = await readBody<{ seenAnswerAt?: unknown }>(event);
    if (typeof seenAnswerAt !== 'number' || !Number.isFinite(seenAnswerAt) || seenAnswerAt < 0) {
        throw createError({ statusCode: 422, statusMessage: 'Say up to which answer the conversation was read' });
    }
    const latest = markRead(user.id, conversationId, seenAnswerAt);
    publishConversationListEvent({ type: 'read', userId: user.id, conversationId, seenAnswerAt: latest });
    return { seenAnswerAt: latest };
});
