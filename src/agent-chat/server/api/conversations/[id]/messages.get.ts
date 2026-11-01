export default defineEventHandler((event) => {
  const before = getQuery(event).before;
  if (typeof before !== 'string' || !before) {
    throw createError({ statusCode: 422, statusMessage: 'The before message is required' });
  }
  const page = getMessagesBefore(getRouterParam(event, 'id')!, before);
  if (!page) {
    throw createError({ statusCode: 404, statusMessage: 'Message not found' });
  }
  return page;
});
