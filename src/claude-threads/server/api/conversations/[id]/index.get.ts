export default defineEventHandler((event) => {
  const detail = getConversationDetail(getRouterParam(event, 'id')!);
  if (!detail) {
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
  }
  return detail;
});
