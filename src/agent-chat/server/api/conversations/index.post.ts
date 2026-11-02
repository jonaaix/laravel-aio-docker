export default defineEventHandler(async (event) => {
    const { text = '', attachments, creatorId } = await readBody<{ text?: string; attachments?: unknown; creatorId?: unknown }>(event);
    const references = readAttachmentReferences(attachments);
    if (!text.trim() && references.length === 0) {
        throw createError({ statusCode: 422, statusMessage: 'Message text or an attachment is required' });
    }
    const sender = findUser(creatorId);
    const conversation = createConversation(titleFromPrompt(text.trim() ? text : references[0]!.filename), resolveWorkingDir(), sender?.id ?? null);
    const stored = adoptUploads(conversation.id, references);
    useConversationRuntime(conversation.id).send(text, stored, localServerOrigin(event), sender);
    return summarize(findConversation(conversation.id)!);
});
