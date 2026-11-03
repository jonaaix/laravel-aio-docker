export default defineEventHandler((event) => {
    const stream = createEventStream(event);
    const unsubscribe = subscribeConversation(getRouterParam(event, 'id')!, (conversationEvent) => {
        stream.push(JSON.stringify(conversationEvent));
    });
    const stopHeartbeat = startHeartbeat(stream);
    stream.onClosed(async () => {
        stopHeartbeat();
        unsubscribe();
        await stream.close();
    });
    return stream.send();
});
