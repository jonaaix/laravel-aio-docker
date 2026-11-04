const MARK_TONES: [mark: string, tone: string][] = [
    ['⚠', 'bg-warning/10'],
    ['❌', 'bg-error/8'],
];

export function markTone(text: string): string | null {
    const start = text.trimStart();
    return MARK_TONES.find(([mark]) => start.startsWith(mark))?.[1] ?? null;
}
