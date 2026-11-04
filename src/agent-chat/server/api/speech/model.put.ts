import { SPEECH_MODELS, isSpeechProvider } from '../../../shared/utils/speech';

export default defineEventHandler(async (event) => {
    sessionUser(event);
    const { provider, model } = await readBody<{ provider?: unknown; model?: unknown }>(event);
    if (!isSpeechProvider(provider) || !SPEECH_MODELS[provider].some(choice => choice.id === model)) {
        throw createError({ statusCode: 422, statusMessage: 'Unknown voice quality' });
    }
    setSpeechModel(provider, model as string);
    return speechServices();
});
