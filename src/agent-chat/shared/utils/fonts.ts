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
    value: number | null;
    label: string;
}

export const TINT_CHOICES: TintChoice[] = [
    { value: null, label: 'Black' },
    { value: 15, label: 'Rose' },
    { value: 40, label: 'Coral' },
    { value: 70, label: 'Amber' },
    { value: 125, label: 'Lime' },
    { value: 150, label: 'Green' },
    { value: 180, label: 'Teal' },
    { value: 205, label: 'Cyan' },
    { value: 235, label: 'Sky' },
    { value: 260, label: 'Blue' },
    { value: 280, label: 'Indigo' },
    { value: 300, label: 'Violet' },
    { value: 340, label: 'Pink' },
];

export const DEFAULT_TINT = null;

export function isTint(value: unknown): value is number | null {
    return TINT_CHOICES.some(choice => choice.value === value);
}
