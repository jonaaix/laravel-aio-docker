export interface FontChoice {
    value: string;
    label: string;
    stack: string;
    scale?: number;
}

export const FONT_CHOICES: FontChoice[] = [
    { value: 'system', label: 'System UI', stack: 'system-ui, -apple-system, \'Segoe UI\', Roboto, sans-serif' },
    { value: 'geist', label: 'Geist', stack: '\'Geist\', ui-sans-serif, system-ui, sans-serif' },
    { value: 'inter', label: 'Inter', stack: '\'Inter\', ui-sans-serif, system-ui, sans-serif' },
    { value: 'source-sans', label: 'Source Sans 3', stack: '\'Source Sans 3\', ui-sans-serif, system-ui, sans-serif' },
    { value: 'ibm-plex-sans', label: 'IBM Plex Sans', stack: '\'IBM Plex Sans\', ui-sans-serif, system-ui, sans-serif' },
    { value: 'jetbrains-mono', label: 'JetBrains Mono', stack: '\'JetBrains Mono\', ui-monospace, monospace', scale: 0.875 },
];

export const DEFAULT_FONT = 'system';

export const COLOR_MODES = ['light', 'dark', 'system'] as const;

export type ColorModeChoice = typeof COLOR_MODES[number];

export function fontChoice(value: string | null | undefined): FontChoice {
    return FONT_CHOICES.find(choice => choice.value === value) ?? FONT_CHOICES.find(choice => choice.value === DEFAULT_FONT)!;
}

export interface TintChoice {
    value: number;
    label: string;
    chroma: number;
}

export const TINT_CHOICES: TintChoice[] = [
    { value: 106, label: 'Stone', chroma: 0.35 },
    { value: 250, label: 'Slate', chroma: 1 },
    { value: 150, label: 'Sage', chroma: 1 },
    { value: 70, label: 'Sand', chroma: 1 },
    { value: 15, label: 'Rose', chroma: 1 },
    { value: 290, label: 'Lavender', chroma: 1 },
];

export const DEFAULT_TINT = 106;

export function tintChoice(value: number): TintChoice {
    return TINT_CHOICES.find(choice => choice.value === value) ?? TINT_CHOICES[0]!;
}

export function isTint(value: unknown): value is number {
    return TINT_CHOICES.some(choice => choice.value === value);
}
