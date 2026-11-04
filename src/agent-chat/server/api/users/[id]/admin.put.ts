export default defineEventHandler(async (event) => {
    adminUser(event);
    const target = findUser(getRouterParam(event, 'id'));
    if (!target) {
        throw createError({ statusCode: 404, statusMessage: 'This person does not exist' });
    }
    const { admin } = await readBody<{ admin?: unknown }>(event);
    if (typeof admin !== 'boolean') {
        throw createError({ statusCode: 422, statusMessage: 'Say whether the person is an admin' });
    }
    if (admin && target.blockedAt) {
        throw createError({ statusCode: 409, statusMessage: 'A blocked person cannot be an admin' });
    }
    return toChatUser(setUserAdmin(target, admin));
});
