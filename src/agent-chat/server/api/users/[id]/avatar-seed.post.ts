export default defineEventHandler(async (event) => {
    const user = ownUser(event);
    const { seed } = await readBody<{ seed?: unknown }>(event);
    if (typeof seed !== 'string' || !seed.trim()) {
        throw createError({ statusCode: 422, statusMessage: 'A seed is required' });
    }
    return toChatUser(setAvatarSeed(user, seed.trim().slice(0, AVATAR_SEED_MAX_LENGTH)));
});
