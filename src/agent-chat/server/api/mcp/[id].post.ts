export default defineEventHandler(async (event) => {
    const conversationId = getRouterParam(event, 'id')!;
    const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!useConversationRuntime(conversationId).acceptsMcpToken(token)) {
        throw createError({ statusCode: 401, statusMessage: 'Invalid token' });
    }
    const body = await readBody(event);
    const messages = Array.isArray(body) ? body : [body];
    const replies = messages.map(message => handleChatMcpMessage(conversationId, message)).filter(reply => reply !== null);
    if (replies.length === 0) {
        setResponseStatus(event, 202);
        return null;
    }
    return Array.isArray(body) ? replies : replies[0];
});
