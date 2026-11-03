export default defineEventHandler(async (event) => {
    const { text = '', attachments } = await readBody<{ text?: string; attachments?: unknown }>(event);
    const references = readAttachmentReferences(attachments);
    if (!text.trim() && references.length === 0) {
        throw createError({ statusCode: 422, statusMessage: 'Message text or an attachment is required' });
    }
    const sender = sessionUser(event);
    const conversation = createConversation(titleFromPrompt(text.trim() ? text : references[0]!.filename), resolveWorkingDir(), sender.id);
    const stored = adoptUploads(conversation.id, references);
    useConversationRuntime(conversation.id).send(text, stored, localServerOrigin(event), sender);
    return summarize(findConversation(conversation.id)!);
});
