export default defineEventHandler((event) => {
    const user = sessionUser(event);
    const stream = createEventStream(event);
    const unsubscribe = subscribeConversation(getRouterParam(event, 'id')!, (conversationEvent) => {
        stream.push(JSON.stringify(conversationEvent));
    });
    const unwatchBlock = onUserBlocked((userId) => {
        if (userId === user.id) {
            void stream.close();
        }
    });
    const stopHeartbeat = startHeartbeat(stream);
    stream.onClosed(async () => {
        stopHeartbeat();
        unsubscribe();
        unwatchBlock();
        await stream.close();
    });
    return stream.send();
});
