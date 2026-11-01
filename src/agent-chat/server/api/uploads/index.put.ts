export default defineEventHandler((event) => {
    const { name } = getQuery(event);
    return receiveUpload(event, typeof name === 'string' ? name : 'file');
});
