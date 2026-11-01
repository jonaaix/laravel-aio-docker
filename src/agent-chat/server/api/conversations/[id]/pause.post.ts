export default defineEventHandler(async (event) => {
    await useConversationRuntime(getRouterParam(event, 'id')!).pause();
    return { ok: true };
});
