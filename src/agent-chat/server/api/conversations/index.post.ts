export default defineEventHandler(async (event) => {
    const { text = '', attachments, creatorName } = await readBody<{ text?: string; attachments?: unknown; creatorName?: unknown }>(event);
    const references = readAttachmentReferences(attachments);
    if (!text.trim() && references.length === 0) {
        throw createError({ statusCode: 422, statusMessage: 'Message text or an attachment is required' });
    }
    const conversation = createConversation(titleFromPrompt(text.trim() ? text : references[0]!.filename), resolveWorkingDir(), normalizeUserName(creatorName));
    const stored = adoptUploads(conversation.id, references);
    useConversationRuntime(conversation.id).send(text, stored, localServerOrigin(event));
    return summarize(findConversation(conversation.id)!);
});
