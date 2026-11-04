import { SPEECH_VOICES, isSpeechProvider } from '../../../shared/utils/speech';

const MAX_SAMPLE_LENGTH = 200;

export default defineEventHandler(async (event) => {
    sessionUser(event);
    const { provider, voice, text } = await readBody<{ provider?: unknown; voice?: unknown; text?: unknown }>(event);
    if (!isSpeechProvider(provider) || !SPEECH_VOICES[provider].some(choice => choice.id === voice)) {
        throw createError({ statusCode: 422, statusMessage: 'Unknown voice' });
    }
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_SAMPLE_LENGTH) {
        throw createError({ statusCode: 422, statusMessage: 'A sample text of up to 200 characters is required' });
    }
    const service = speechServiceFor(provider);
    if (!service) {
        throw createError({ statusCode: 404, statusMessage: 'This voice service has no key yet' });
    }
    try {
        const audio = await cachedSpeech(service, text.trim(), voice as string);
        setResponseHeader(event, 'content-type', audio.mediaType);
        return audio.data;
    }
    catch (failure) {
        if (failure instanceof SpeechServiceError) {
            throw createError({ statusCode: 502, statusMessage: failure.message });
        }
        throw failure;
    }
});
