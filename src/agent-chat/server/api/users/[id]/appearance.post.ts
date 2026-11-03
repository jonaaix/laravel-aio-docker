import { COLOR_MODES, FONT_CHOICES, isTint, type ColorModeChoice } from '../../../../shared/utils/fonts';
import { isLanguage } from '../../../../shared/utils/languages';

export default defineEventHandler(async (event) => {
    const user = ownUser(event);
    const { colorMode, font, language, pinSentMessage, tint } = await readBody<{ colorMode?: unknown; font?: unknown; language?: unknown; pinSentMessage?: unknown; tint?: unknown }>(event);
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
    if (language !== undefined) {
        if (!isLanguage(language)) {
            throw createError({ statusCode: 422, statusMessage: 'Unknown language' });
        }
        changes.language = language;
    }
    if (tint !== undefined) {
        if (!isTint(tint)) {
            throw createError({ statusCode: 422, statusMessage: 'The tint must be a hue from 0 to 360' });
        }
        changes.tint = tint;
    }
    if (typeof pinSentMessage === 'boolean') {
        changes.pinSentMessage = pinSentMessage;
    }
    return toChatUser(Object.keys(changes).length > 0 ? setUserAppearance(user, changes) : user);
});
