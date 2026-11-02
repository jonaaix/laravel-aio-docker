export default defineEventHandler(async (event) => {
    const user = findUser(getRouterParam(event, 'id'));
    if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' });
    }
    const name = normalizeUserName((await readBody<{ name?: unknown }>(event)).name);
    if (!name) {
        throw createError({ statusCode: 422, statusMessage: 'A name is required' });
    }
    const { id, name: storedName } = renameUser(user.id, name);
    return { id, name: storedName };
});
