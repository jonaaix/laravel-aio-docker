export default defineEventHandler((event) => {
    useConversationRuntime(getRouterParam(event, 'id')!).stop();
    return { ok: true };
});
