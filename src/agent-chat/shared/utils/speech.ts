export const SPEECH_RATES = [1, 1.25, 1.5, 1.75, 2] as const;

export const DEFAULT_SPEECH_RATE = 1.5;

export function isSpeechRate(value: unknown): value is number {
    return (SPEECH_RATES as readonly unknown[]).includes(value);
}

export const SPEECH_PROVIDERS = ['gemini', 'elevenlabs'] as const;

export type SpeechProvider = typeof SPEECH_PROVIDERS[number];

export function isSpeechProvider(value: unknown): value is SpeechProvider {
    return (SPEECH_PROVIDERS as readonly unknown[]).includes(value);
}
