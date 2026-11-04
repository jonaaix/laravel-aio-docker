export const SPEECH_RATES = [1, 1.25, 1.5, 1.75, 2] as const;

export const DEFAULT_SPEECH_RATE = 1.5;

export function isSpeechRate(value: unknown): value is number {
    return (SPEECH_RATES as readonly unknown[]).includes(value);
}
