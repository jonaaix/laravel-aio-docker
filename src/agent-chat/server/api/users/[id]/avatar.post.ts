export default defineEventHandler(async (event) => {
    const user = findUser(getRouterParam(event, 'id'));
    if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' });
    }
    const { upload } = await readBody<{ upload?: unknown }>(event);
    const [reference] = upload ? readAttachmentReferences([upload]) : [];
    return toChatUser(setUploadedAvatar(user, reference ?? null));
});
