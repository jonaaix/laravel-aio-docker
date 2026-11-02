export default defineEventHandler(async (event) => {
    const name = normalizeUserName((await readBody<{ name?: unknown }>(event)).name);
    if (!name) {
        throw createError({ statusCode: 422, statusMessage: 'A name is required' });
    }
    const { id, name: storedName } = findOrCreateUser(name);
    return { id, name: storedName };
});
