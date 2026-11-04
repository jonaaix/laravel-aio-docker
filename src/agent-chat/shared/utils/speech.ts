export const SPEECH_RATES = [1, 1.25, 1.5, 1.75, 2] as const;

export const DEFAULT_SPEECH_RATE = 1.5;

export function isSpeechRate(value: unknown): value is number {
    return (SPEECH_RATES as readonly unknown[]).includes(value);
}

export const SPEECH_PROVIDERS = ['gemini', 'elevenlabs', 'openai'] as const;

export type SpeechProvider = typeof SPEECH_PROVIDERS[number];

export function isSpeechProvider(value: unknown): value is SpeechProvider {
    return (SPEECH_PROVIDERS as readonly unknown[]).includes(value);
}

export interface SpeechModel {
    id: string;
    label: string;
    dollarsPerHour: number;
}

export interface SpeechVoice {
    id: string;
    label: string;
}

// List prices as of 2026-11, converted to one hour of reading (about 55,000 characters); ElevenLabs' Multilingual tier is left out on purpose for its cost.
export const SPEECH_MODELS: Record<SpeechProvider, SpeechModel[]> = {
    gemini: [
        { id: 'gemini-3.8-flash-lite-tts', label: 'Flash-Lite', dollarsPerHour: 0.55 },
        { id: 'gemini-3.8-flash-tts', label: 'Flash', dollarsPerHour: 0.8 },
    ],
    elevenlabs: [
        { id: 'eleven_flash_v2_5', label: 'Flash v2.5', dollarsPerHour: 2.8 },
    ],
    openai: [
        { id: 'tts-1', label: 'TTS-1', dollarsPerHour: 0.85 },
        { id: 'gpt-4o-mini-tts', label: 'GPT-4o mini TTS', dollarsPerHour: 0.9 },
        { id: 'tts-1-hd', label: 'TTS-1 HD', dollarsPerHour: 1.7 },
    ],
};

export const SPEECH_VOICES: Record<SpeechProvider, SpeechVoice[]> = {
    gemini: [
        { id: 'Sulafat', label: 'Sulafat' },
        { id: 'Kore', label: 'Kore' },
        { id: 'Aoede', label: 'Aoede' },
        { id: 'Puck', label: 'Puck' },
        { id: 'Charon', label: 'Charon' },
        { id: 'Fenrir', label: 'Fenrir' },
    ],
    elevenlabs: [
        { id: 'JBFqnCBsd6RMkjVDRZzb', label: 'George' },
        { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah' },
        { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel' },
        { id: 'Xb7hH8MSUJpSbSDYk0k2', label: 'Alice' },
        { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam' },
        { id: 'pFZP5JQG7iQjIQuC4Bku', label: 'Lily' },
    ],
    openai: [
        { id: 'nova', label: 'Nova' },
        { id: 'shimmer', label: 'Shimmer' },
        { id: 'alloy', label: 'Alloy' },
        { id: 'fable', label: 'Fable' },
        { id: 'echo', label: 'Echo' },
        { id: 'onyx', label: 'Onyx' },
    ],
};

export function speechModel(provider: SpeechProvider, id: unknown): SpeechModel {
    return SPEECH_MODELS[provider].find(model => model.id === id) ?? SPEECH_MODELS[provider][0]!;
}

export function speechVoice(provider: SpeechProvider, id: unknown): SpeechVoice {
    return SPEECH_VOICES[provider].find(voice => voice.id === id) ?? SPEECH_VOICES[provider][0]!;
}
