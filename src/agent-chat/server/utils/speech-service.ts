import { isSpeechProvider, type SpeechProvider } from '../../shared/utils/speech';

const PROVIDER_SETTING = 'speech.provider';
const KEY_SETTING = 'speech.apiKey';

export interface SpeechService {
    provider: SpeechProvider;
    apiKey: string;
}

export function speechService(): SpeechService | null {
    const provider = readSetting(PROVIDER_SETTING);
    const box = readSetting(KEY_SETTING);
    const apiKey = box ? openSecret(chatKey(), box) : null;
    return isSpeechProvider(provider) && apiKey ? { provider, apiKey } : null;
}

export function storeSpeechService(service: SpeechService): void {
    writeSetting(PROVIDER_SETTING, service.provider);
    writeSetting(KEY_SETTING, sealSecret(chatKey(), service.apiKey));
}

export function removeSpeechService(): void {
    removeSetting(KEY_SETTING);
    removeSetting(PROVIDER_SETTING);
}
