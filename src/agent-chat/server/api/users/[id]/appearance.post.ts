export default defineEventHandler(async (event) => {
    const user = findUser(getRouterParam(event, 'id'));
    if (!user) {
        throw createError({ statusCode: 404, statusMessage: 'User not found' });
    }
    const { colorMode, font, pinSentMessage } = await readBody<{ colorMode?: unknown; font?: unknown; pinSentMessage?: unknown }>(event);
    const changes: Parameters<typeof setUserAppearance>[1] = {};
    if (colorMode !== undefined) {
        if (!(COLOR_MODES as readonly unknown[]).includes(colorMode)) {
            throw createError({ statusCode: 422, statusMessage: 'Unknown color mode' });
        }
        changes.colorMode = colorMode as ColorModeChoice;
    }
    if (font !== undefined) {
        if (!FONT_CHOICES.some(choice => choice.value === font)) {
            throw createError({ statusCode: 422, statusMessage: 'Unknown font' });
        }
        changes.font = font as string;
    }
    if (typeof pinSentMessage === 'boolean') {
        changes.pinSentMessage = pinSentMessage;
    }
    return toChatUser(Object.keys(changes).length > 0 ? setUserAppearance(user, changes) : user);
});
