export default defineEventHandler(async (event) => {
    adminUser(event);
    const target = findUser(getRouterParam(event, 'id'));
    if (!target) {
        throw createError({ statusCode: 404, statusMessage: 'This person does not exist' });
    }
    const { shown } = await readBody<{ shown?: unknown }>(event);
    if (typeof shown !== 'boolean') {
        throw createError({ statusCode: 422, statusMessage: 'Say whether the person sees the account details' });
    }
    const followsEveryone = shown === !accountDetailsHidden();
    const updated = setUserAccountDetails(target, followsEveryone ? null : shown ? 'shown' : 'hidden');
    publishConversationListEvent({ type: 'account' });
    return toChatUser(updated);
});
