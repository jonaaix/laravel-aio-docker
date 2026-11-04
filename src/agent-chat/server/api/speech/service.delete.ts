export default defineEventHandler((event) => {
    sessionUser(event);
    removeSpeechService();
    return { provider: null };
});
