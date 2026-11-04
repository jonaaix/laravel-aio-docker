const MAX_RECORDING_BYTES = 20 * 1024 * 1024;

export default defineEventHandler(async (event) => {
    sessionUser(event);
    const audio = (await readMultipartFormData(event))?.find(part => part.name === 'audio');
    if (!audio?.data.length || !audio.type?.startsWith('audio/')) {
        throw createError({ statusCode: 422, statusMessage: 'An audio recording is required' });
    }
    if (audio.data.length > MAX_RECORDING_BYTES) {
        throw createError({ statusCode: 413, statusMessage: 'The recording is too long' });
    }
    const service = speechService();
    if (!service) {
        throw createError({ statusCode: 404, statusMessage: 'No voice service is set up' });
    }
    try {
        return { text: await transcribeSpeech(service, { data: audio.data, mediaType: audio.type }) };
    }
    catch (failure) {
        if (failure instanceof SpeechServiceError) {
            throw speechServiceHttpError(failure);
        }
        throw failure;
    }
});
