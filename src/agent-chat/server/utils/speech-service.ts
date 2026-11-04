import { SPEECH_PROVIDERS, isSpeechProvider, speechModel, type SpeechProvider } from '../../shared/utils/speech';

const ACTIVE_SETTING = 'speech.provider';
const LEGACY_KEY_SETTING = 'speech.apiKey';

export interface SpeechService {
    provider: SpeechProvider;
    apiKey: string;
    model: string;
}

export interface SpeechServices {
    provider: SpeechProvider | null;
    stored: SpeechProvider[];
    models: Record<SpeechProvider, string>;
}

function modelSetting(provider: SpeechProvider): string {
    return `speech.model.${provider}`;
}

export function chosenSpeechModel(provider: SpeechProvider): string {
    return speechModel(provider, readSetting(modelSetting(provider))).id;
}

export function setSpeechModel(provider: SpeechProvider, model: string): void {
    writeSetting(modelSetting(provider), speechModel(provider, model).id);
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
    const models = Object.fromEntries(SPEECH_PROVIDERS.map(provider => [provider, chosenSpeechModel(provider)])) as Record<SpeechProvider, string>;
    return { provider: isSpeechProvider(active) && stored.includes(active) ? active : null, stored, models };
}

export function speechServiceFor(provider: SpeechProvider): SpeechService | null {
    const apiKey = storedKey(provider);
    return apiKey ? { provider, apiKey, model: chosenSpeechModel(provider) } : null;
}

export function speechService(): SpeechService | null {
    const { provider } = speechServices();
    return provider ? speechServiceFor(provider) : null;
}

export function storeSpeechKey(service: Omit<SpeechService, 'model'>): void {
    writeSetting(keySetting(service.provider), sealSecret(chatKey(), service.apiKey));
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
