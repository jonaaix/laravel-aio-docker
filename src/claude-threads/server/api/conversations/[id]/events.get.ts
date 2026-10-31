export default defineEventHandler((event) => {
  const stream = createEventStream(event);
  const unsubscribe = subscribeConversation(getRouterParam(event, 'id')!, (conversationEvent) => {
    stream.push(JSON.stringify(conversationEvent));
  });
  stream.onClosed(async () => {
    unsubscribe();
    await stream.close();
  });
  return stream.send();
});
