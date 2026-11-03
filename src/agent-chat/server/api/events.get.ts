export default defineEventHandler((event) => {
    const stream = createEventStream(event);
    const unsubscribe = subscribeConversationList((listEvent) => {
        stream.push(JSON.stringify(listEvent));
    });
    const stopHeartbeat = startHeartbeat(stream);
    stream.onClosed(async () => {
        stopHeartbeat();
        unsubscribe();
        await stream.close();
    });
    return stream.send();
});
