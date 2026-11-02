export default defineEventHandler(async (event) => {
    const body = await readBody<{ name?: unknown; avatarUrl?: unknown }>(event);
    const name = normalizeUserName(body.name);
    if (!name) {
        throw createError({ statusCode: 422, statusMessage: 'A name is required' });
    }
    const user = findOrCreateUser(name);
    return toChatUser(typeof body.avatarUrl === 'string' ? await syncLinkedAvatar(user, body.avatarUrl) : user);
});
