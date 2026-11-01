export default defineEventHandler(async (event) => {
    const { text } = await readBody<{ text?: string }>(event);
    if (!text?.trim()) {
        throw createError({ statusCode: 422, statusMessage: 'Message text is required' });
    }
    useConversationRuntime(getRouterParam(event, 'id')!).send(text, localServerOrigin(event));
    return { ok: true };
});
