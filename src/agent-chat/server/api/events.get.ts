export default defineEventHandler((event) => {
    const stream = createEventStream(event);
    const unsubscribe = subscribeConversationList((listEvent) => {
        stream.push(JSON.stringify(listEvent));
    });
    stream.onClosed(async () => {
        unsubscribe();
        await stream.close();
    });
    return stream.send();
});
