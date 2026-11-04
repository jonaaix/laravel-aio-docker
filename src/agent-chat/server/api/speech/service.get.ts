export default defineEventHandler((event) => {
    sessionUser(event);
    return { provider: speechService()?.provider ?? null };
});
