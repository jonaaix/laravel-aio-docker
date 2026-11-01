export default defineEventHandler(async (event) => {
    const { text = '', attachments } = await readBody<{ text?: string; attachments?: unknown }>(event);
    const references = readAttachmentReferences(attachments);
    if (!text.trim() && references.length === 0) {
        throw createError({ statusCode: 422, statusMessage: 'Message text or an attachment is required' });
    }
    const id = getRouterParam(event, 'id')!;
    const conversation = findConversation(id);
    if (!conversation) {
        throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
    }
    if (conversation.archivedAt !== null) {
        throw createError({ statusCode: 409, statusMessage: 'Conversation is archived' });
    }
    useConversationRuntime(id).send(text, adoptUploads(id, references), localServerOrigin(event));
    return { ok: true };
});
