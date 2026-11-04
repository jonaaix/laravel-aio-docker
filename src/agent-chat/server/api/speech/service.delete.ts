import { isSpeechProvider } from '../../../shared/utils/speech';

export default defineEventHandler((event) => {
    sessionUser(event);
    const { provider } = getQuery(event);
    if (!isSpeechProvider(provider)) {
        throw createError({ statusCode: 422, statusMessage: 'Unknown voice service' });
    }
    removeSpeechKey(provider);
    return speechServices();
});
