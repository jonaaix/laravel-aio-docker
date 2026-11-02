export default defineEventHandler(async (event) => {
    const user = findUser(getRouterParam(event, 'id'));
    if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' });
    }
    const { seed } = await readBody<{ seed?: unknown }>(event);
    if (typeof seed !== 'string' || !seed.trim()) {
        throw createError({ statusCode: 422, statusMessage: 'A seed is required' });
    }
    return toChatUser(setAvatarSeed(user, seed.trim().slice(0, AVATAR_SEED_MAX_LENGTH)));
});
