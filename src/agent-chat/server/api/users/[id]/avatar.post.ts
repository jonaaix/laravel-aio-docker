export default defineEventHandler(async (event) => {
    const user = ownUser(event);
    const { upload } = await readBody<{ upload?: unknown }>(event);
    const [reference] = upload ? readAttachmentReferences([upload]) : [];
    return toChatUser(setUploadedAvatar(user, reference ?? null));
});
