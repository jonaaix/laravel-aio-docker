export default defineEventHandler(async (event) => {
    const { text } = await readBody<{ text?: string }>(event);
    if (!text?.trim()) {
        throw createError({ statusCode: 422, statusMessage: 'Message text is required' });
    }
    const conversation = createConversation(titleFromPrompt(text), resolveWorkingDir());
    useConversationRuntime(conversation.id).send(text, localServerOrigin(event));
    return summarize(findConversation(conversation.id)!);
});
