export default defineEventHandler((event) => {
    const agent = findAgent(getRouterParam(event, 'id'));
    if (!agent) {
        throw createError({ statusCode: 404, statusMessage: 'Agent not found' });
    }
    deleteAgent(agent);
    return { ok: true };
});
