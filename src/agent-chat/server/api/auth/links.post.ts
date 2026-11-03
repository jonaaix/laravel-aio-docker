export default defineEventHandler(async (event) => {
    const given = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!isChatKey(chatKey(), given)) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
    const body = await readBody<{ name?: unknown; avatarUrl?: unknown }>(event);
    const name = normalizeUserName(body.name);
    if (!name) {
        throw createError({ statusCode: 422, statusMessage: 'A name is required' });
    }
    const avatarUrl = typeof body.avatarUrl === 'string' && body.avatarUrl.trim() ? body.avatarUrl.trim() : null;
    const params = createSignInParams(chatKey(), { name, avatarUrl });
    return { path: `${useRuntimeConfig().app.baseURL}?${new URLSearchParams({ ...params })}` };
});
