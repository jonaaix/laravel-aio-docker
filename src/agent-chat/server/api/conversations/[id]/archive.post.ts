export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!;
  if (!findConversation(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
  }
  await useConversationRuntime(id).pause();
  return setConversationArchived(id, Date.now());
});
