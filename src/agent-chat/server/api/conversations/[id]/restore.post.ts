export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')!;
  if (!findConversation(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
  }
  return setConversationArchived(id, null);
});
