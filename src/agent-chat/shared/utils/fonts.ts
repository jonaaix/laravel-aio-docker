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
    chroma?: number;
    lightness?: number;
}

const LIGHT_MODE_LIGHTNESS = 0.5;

export const TINT_CHOICES: TintChoice[] = [
    { value: null, label: 'Black' },
    { value: 0, label: 'Gray', chroma: 0 },
    { value: 12, label: 'Burgundy', chroma: 1.1, lightness: 0.42 },
    { value: 15, label: 'Rose' },
    { value: 28, label: 'Red' },
    { value: 40, label: 'Coral' },
    { value: 50, label: 'Chocolate', chroma: 0.75, lightness: 0.42 },
    { value: 70, label: 'Amber' },
    { value: 85, label: 'Gold', lightness: 0.65 },
    { value: 115, label: 'Olive', chroma: 0.9 },
    { value: 125, label: 'Lime' },
    { value: 150, label: 'Green' },
    { value: 180, label: 'Teal' },
    { value: 190, label: 'Turquoise', lightness: 0.58 },
    { value: 205, label: 'Cyan' },
    { value: 215, label: 'Petrol', chroma: 0.8, lightness: 0.45 },
    { value: 235, label: 'Sky' },
    { value: 260, label: 'Blue' },
    { value: 265, label: 'Navy', chroma: 0.9, lightness: 0.38 },
    { value: 280, label: 'Indigo' },
    { value: 300, label: 'Violet' },
    { value: 320, label: 'Magenta' },
    { value: 330, label: 'Plum', chroma: 0.9, lightness: 0.42 },
    { value: 340, label: 'Pink' },
];

export const DEFAULT_TINT = null;

export function isTint(value: unknown): value is number | null {
    return TINT_CHOICES.some(choice => choice.value === value);
}

export function tintChroma(value: number | null): number {
    if (value === null) {
        return 0;
    }
    return TINT_CHOICES.find(choice => choice.value === value)?.chroma ?? 1;
}

export function tintLightness(value: number | null): number {
    return TINT_CHOICES.find(choice => choice.value === value)?.lightness ?? LIGHT_MODE_LIGHTNESS;
}
