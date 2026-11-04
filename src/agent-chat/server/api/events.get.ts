export default defineEventHandler((event) => {
    const user = sessionUser(event);
    const stream = createEventStream(event);
    const unsubscribe = subscribeConversationList((listEvent) => {
        stream.push(JSON.stringify(listEvent.type === 'usage' ? { ...listEvent, usage: visibleUsage(listEvent.usage, findUser(user.id) ?? user) } : listEvent));
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
