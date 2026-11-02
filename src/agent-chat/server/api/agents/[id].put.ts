export default defineEventHandler(async (event) => {
    const agent = findAgent(getRouterParam(event, 'id'));
    if (!agent) {
        throw createError({ statusCode: 404, statusMessage: 'Agent not found' });
    }
    return updateAgent(agent, readAgentChanges(await readBody<Record<string, unknown>>(event)));
});
