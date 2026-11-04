export default defineEventHandler(async (event) => {
    adminUser(event);
    const { hidden } = await readBody<{ hidden?: unknown }>(event);
    if (typeof hidden !== 'boolean') {
        throw createError({ statusCode: 422, statusMessage: 'Say whether the details are hidden' });
    }
    setAccountDetailsHidden(hidden);
    return { hidden };
});
