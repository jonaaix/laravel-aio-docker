import { isSpeechProvider } from '../../../shared/utils/speech';

const KEY_CHECK_TEXT = 'OK';

export default defineEventHandler(async (event) => {
    sessionUser(event);
    const { provider, apiKey } = await readBody<{ provider?: unknown; apiKey?: unknown }>(event);
    if (!isSpeechProvider(provider)) {
        throw createError({ statusCode: 422, statusMessage: 'Unknown voice service' });
    }
    if (typeof apiKey !== 'string' || !apiKey.trim()) {
        throw createError({ statusCode: 422, statusMessage: 'An API key is required' });
    }
    const service = { provider, apiKey: apiKey.trim() };
    try {
        await synthesizeSpeech(service, KEY_CHECK_TEXT);
    }
    catch (failure) {
        if (failure instanceof SpeechServiceError) {
            throw createError({ statusCode: failure.keyRejected ? 422 : 502, statusMessage: failure.message });
        }
        throw failure;
    }
    storeSpeechKey(service);
    return speechServices();
});
