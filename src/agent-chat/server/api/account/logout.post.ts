export default defineEventHandler(async (event) => {
    const { id } = await readBody<{ id?: unknown }>(event) ?? {};
    const accountId = typeof id === 'string' ? id : activeAccountId();
    if (!claudeAccounts().some(account => account.id === accountId)) {
        throw createError({ statusCode: 404, statusMessage: 'Unknown account' });
    }
    try {
        await signOutClaudeAccount(accountId);
    }
    catch {
        throw createError({ statusCode: 502, statusMessage: 'Claude could not sign out.' });
    }
    return accountStatusFor(sessionUser(event));
});
