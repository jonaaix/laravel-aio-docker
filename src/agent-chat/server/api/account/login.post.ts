export default defineEventHandler(async () => {
    try {
        return { url: await startClaudeLogin() };
    }
    catch (error) {
        throw createError({ statusCode: 502, statusMessage: (error as Error).message });
    }
});
