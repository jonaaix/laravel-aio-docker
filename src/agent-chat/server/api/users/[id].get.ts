export default defineEventHandler((event) => {
    const user = findUser(getRouterParam(event, 'id'));
    if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' });
    }
    return toChatUser(user);
});
