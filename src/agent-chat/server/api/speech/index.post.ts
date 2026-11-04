const MAX_TEXT_LENGTH = 2_000;

export default defineEventHandler(async (event) => {
    const user = sessionUser(event);
    const { text } = await readBody<{ text?: unknown }>(event);
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT_LENGTH) {
        throw createError({ statusCode: 422, statusMessage: 'A text of up to 2000 characters is required' });
    }
    const service = speechService();
    if (!service) {
        throw createError({ statusCode: 404, statusMessage: 'No voice service is set up' });
    }
    try {
        const audio = await cachedSpeech(service, text.trim(), user.speechVoices?.[service.provider] ?? '');
        setResponseHeader(event, 'content-type', audio.mediaType);
        return audio.data;
    }
    catch (failure) {
        if (failure instanceof SpeechServiceError) {
            throw speechServiceHttpError(failure);
        }
        throw failure;
    }
});
