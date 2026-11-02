export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!;
    const conversation = findConversation(id);
    if (!conversation) {
        throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
    }
    const { agentId, member } = await readBody<{ agentId?: unknown; member?: unknown }>(event);
    const agent = findAgent(agentId);
    if (!agent || agent.lead) {
        throw createError({ statusCode: 422, statusMessage: 'Agent not found' });
    }
    setConversationAgent(id, agent.id, member === true);
    if (member !== true) {
        useConversationRuntime(id).removeAgent(agent.id);
    }
    const summary = summarize(findConversation(id)!);
    publishConversationListEvent({ type: 'conversation', conversation: summary });
    return summary;
});
