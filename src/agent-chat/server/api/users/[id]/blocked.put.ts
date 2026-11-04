export default defineEventHandler(async (event) => {
    const admin = adminUser(event);
    const target = findUser(getRouterParam(event, 'id'));
    if (!target) {
        throw createError({ statusCode: 404, statusMessage: 'This person does not exist' });
    }
    const { blocked } = await readBody<{ blocked?: unknown }>(event);
    if (typeof blocked !== 'boolean') {
        throw createError({ statusCode: 422, statusMessage: 'Say whether the person is blocked' });
    }
    if (blocked && target.id === admin.id) {
        throw createError({ statusCode: 409, statusMessage: 'You cannot block yourself' });
    }
    return toChatUser(setUserBlocked(target, blocked));
});
