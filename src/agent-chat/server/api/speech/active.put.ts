import { isSpeechProvider } from '../../../shared/utils/speech';

export default defineEventHandler(async (event) => {
    sessionUser(event);
    const { provider } = await readBody<{ provider?: unknown }>(event);
    if (provider !== null && !isSpeechProvider(provider)) {
        throw createError({ statusCode: 422, statusMessage: 'Unknown voice service' });
    }
    if (provider !== null && !speechServices().stored.includes(provider)) {
        throw createError({ statusCode: 422, statusMessage: 'This voice service has no key yet' });
    }
    setActiveSpeechProvider(provider);
    return speechServices();
});
