export default defineEventHandler(async (event) => {
    const given = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    if (!isChatKey(chatKey(), given)) {
        throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    }
    const body = await readBody<{ name?: unknown; avatarUrl?: unknown; userRef?: unknown }>(event);
    const name = normalizeUserName(body.name);
    if (!name) {
        throw createError({ statusCode: 422, statusMessage: 'A name is required' });
    }
    const userRef = typeof body.userRef === 'string' || typeof body.userRef === 'number' ? String(body.userRef).trim() : '';
    if (!userRef) {
        throw createError({ statusCode: 422, statusMessage: 'A user reference is required' });
    }
    if (isAppUserBlocked(userRef)) {
        throw createError({ statusCode: 403, statusMessage: 'This person is blocked' });
    }
    if (isNameTakenByOther(name, userRef)) {
        throw createError({ statusCode: 409, statusMessage: 'This name is already taken' });
    }
    const avatarUrl = typeof body.avatarUrl === 'string' && body.avatarUrl.trim() ? body.avatarUrl.trim() : null;
    const params = createSignInParams(chatKey(), { name, avatarUrl, userRef });
    return { path: `${useRuntimeConfig().app.baseURL}?${new URLSearchParams({ ...params })}` };
});
