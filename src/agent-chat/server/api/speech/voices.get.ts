import { SPEECH_VOICES, isSpeechProvider } from '../../../shared/utils/speech';

export default defineEventHandler(async (event) => {
    sessionUser(event);
    const { provider, language } = getQuery(event);
    if (!isSpeechProvider(provider)) {
        throw createError({ statusCode: 422, statusMessage: 'Unknown voice service' });
    }
    const service = speechServiceFor(provider);
    if (!service) {
        throw createError({ statusCode: 404, statusMessage: 'This voice service has no key yet' });
    }
    if (provider !== 'google') {
        return { soundsLike: Object.fromEntries(SPEECH_VOICES[provider].map(voice => [voice.id, voice.id])) };
    }
    try {
        return { soundsLike: await googleSoundsLike(service.apiKey, service.model, googleLocale(typeof language === 'string' ? language : '')) };
    }
    catch (failure) {
        if (failure instanceof SpeechServiceError) {
            throw speechServiceHttpError(failure);
        }
        throw failure;
    }
});
