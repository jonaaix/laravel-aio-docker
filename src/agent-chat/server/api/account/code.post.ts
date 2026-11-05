export default defineEventHandler(async (event) => {
    const { code } = await readBody<{ code?: unknown }>(event);
    if (typeof code !== 'string' || !code.trim()) {
        throw createError({ statusCode: 422, statusMessage: 'Enter the code from the sign-in page.' });
    }
    const user = sessionUser(event);
    try {
        const accountId = await submitClaudeLoginCode(code.trim());
        await rememberSignedInAccount(accountId, user);
    }
    catch (error) {
        throw createError({ statusCode: 422, statusMessage: (error as Error).message });
    }
    return accountStatusFor(user);
});
