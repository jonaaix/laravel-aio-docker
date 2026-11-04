import { COLOR_MODES, FONT_CHOICES, isTint, type ColorModeChoice } from '../../../../shared/utils/fonts';
import { isLanguage } from '../../../../shared/utils/languages';
import { SPEECH_VOICES, isSpeechProvider, isSpeechRate } from '../../../../shared/utils/speech';

export default defineEventHandler(async (event) => {
    const user = ownUser(event);
    const { colorMode, font, language, pinSentMessage, changesPanelHidden, changesPanelAuto, doneSound, tint, speechRate, speechVoice } = await readBody<{ colorMode?: unknown; font?: unknown; language?: unknown; pinSentMessage?: unknown; changesPanelHidden?: unknown; changesPanelAuto?: unknown; doneSound?: unknown; speechVoice?: { provider?: unknown; voice?: unknown }; tint?: unknown; speechRate?: unknown }>(event);
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
            throw createError({ statusCode: 422, statusMessage: 'Unknown colour' });
        }
        changes.tint = tint;
    }
    if (speechRate !== undefined) {
        if (!isSpeechRate(speechRate)) {
            throw createError({ statusCode: 422, statusMessage: 'Unknown reading speed' });
        }
        changes.speechRate = speechRate;
    }
    if (typeof pinSentMessage === 'boolean') {
        changes.pinSentMessage = pinSentMessage;
    }
    if (typeof changesPanelHidden === 'boolean') {
        changes.changesPanelHidden = changesPanelHidden;
    }
    if (typeof changesPanelAuto === 'boolean') {
        changes.changesPanelAuto = changesPanelAuto;
    }
    if (typeof doneSound === 'boolean') {
        changes.doneSound = doneSound;
    }
    if (speechVoice !== undefined) {
        const { provider, voice } = speechVoice ?? {};
        if (!isSpeechProvider(provider) || !SPEECH_VOICES[provider].some(choice => choice.id === voice)) {
            throw createError({ statusCode: 422, statusMessage: 'Unknown voice' });
        }
        changes.speechVoices = { ...user.speechVoices, [provider]: voice as string };
    }
    return toChatUser(Object.keys(changes).length > 0 ? setUserAppearance(user, changes) : user);
});
