import { SPEECH_PROVIDERS, isSpeechProvider, type SpeechProvider } from '../../shared/utils/speech';

const ACTIVE_SETTING = 'speech.provider';
const LEGACY_KEY_SETTING = 'speech.apiKey';

export interface SpeechService {
    provider: SpeechProvider;
    apiKey: string;
}

export interface SpeechServices {
    provider: SpeechProvider | null;
    stored: SpeechProvider[];
}

function keySetting(provider: SpeechProvider): string {
    return `${LEGACY_KEY_SETTING}.${provider}`;
}

function adoptLegacyKey(): void {
    const legacy = readSetting(LEGACY_KEY_SETTING);
    if (!legacy) {
        return;
    }
    const provider = readSetting(ACTIVE_SETTING);
    if (isSpeechProvider(provider)) {
        writeSetting(keySetting(provider), legacy);
    }
    removeSetting(LEGACY_KEY_SETTING);
}

function storedKey(provider: SpeechProvider): string | null {
    adoptLegacyKey();
    const box = readSetting(keySetting(provider));
    return box ? openSecret(chatKey(), box) : null;
}

export function speechServices(): SpeechServices {
    adoptLegacyKey();
    const stored = SPEECH_PROVIDERS.filter(provider => readSetting(keySetting(provider)) !== null);
    const active = readSetting(ACTIVE_SETTING);
    return { provider: isSpeechProvider(active) && stored.includes(active) ? active : null, stored };
}

export function speechService(): SpeechService | null {
    const { provider } = speechServices();
    const apiKey = provider ? storedKey(provider) : null;
    return provider && apiKey ? { provider, apiKey } : null;
}

export function storeSpeechKey(service: SpeechService): void {
    writeSetting(keySetting(service.provider), sealSecret(chatKey(), service.apiKey));
    writeSetting(ACTIVE_SETTING, service.provider);
}

export function setActiveSpeechProvider(provider: SpeechProvider | null): void {
    if (provider) {
        writeSetting(ACTIVE_SETTING, provider);
    }
    else {
        removeSetting(ACTIVE_SETTING);
    }
}

export function removeSpeechKey(provider: SpeechProvider): void {
    removeSetting(keySetting(provider));
    if (readSetting(ACTIVE_SETTING) === provider) {
        removeSetting(ACTIVE_SETTING);
    }
}
