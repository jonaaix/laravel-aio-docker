export default defineEventHandler(async (event) => {
    const { id } = await readBody<{ id?: unknown }>(event);
    if (typeof id !== 'string' || !claudeAccounts().some(account => account.id === id)) {
        throw createError({ statusCode: 404, statusMessage: 'Unknown account' });
    }
    switchClaudeAccount(id);
    return accountStatusFor(sessionUser(event));
});
