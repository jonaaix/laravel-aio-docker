export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')!;
    const conversation = findConversation(id);
    if (!conversation) {
        throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
    }
    const { agentId, member } = await readBody<{ agentId?: unknown; member?: unknown }>(event);
    if (!isMembershipFlag(member)) {
        throw createError({ statusCode: 422, statusMessage: 'member must be true or false' });
    }
    const agent = findAgent(agentId);
    if (!agent || agent.lead) {
        throw createError({ statusCode: 422, statusMessage: 'Agent not found' });
    }
    setConversationAgent(id, agent.id, member);
    if (!member) {
        useConversationRuntime(id).removeAgent(agent.id);
    }
    const summary = summarize(findConversation(id)!);
    publishConversationListEvent({ type: 'conversation', conversation: summary });
    return summary;
});
