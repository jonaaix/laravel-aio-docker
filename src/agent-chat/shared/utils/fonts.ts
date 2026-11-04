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
    muted?: boolean;
    chroma?: number;
}

const MUTED_CHROMA = 0.4;

export const TINT_CHOICES: TintChoice[] = [
    { value: null, label: 'Black' },
    { value: 15, label: 'Rose' },
    { value: 28, label: 'Red' },
    { value: 40, label: 'Coral' },
    { value: 70, label: 'Amber' },
    { value: 95, label: 'Yellow' },
    { value: 125, label: 'Lime' },
    { value: 150, label: 'Green' },
    { value: 180, label: 'Teal' },
    { value: 205, label: 'Cyan' },
    { value: 235, label: 'Sky' },
    { value: 260, label: 'Blue' },
    { value: 280, label: 'Indigo' },
    { value: 300, label: 'Violet' },
    { value: 320, label: 'Magenta' },
    { value: 340, label: 'Pink' },
    { value: 0, label: 'Gray', muted: true, chroma: 0 },
    { value: 10, label: 'Dusty rose', muted: true },
    { value: 25, label: 'Brick', muted: true },
    { value: 45, label: 'Clay', muted: true },
    { value: 60, label: 'Taupe', muted: true, chroma: 0.2 },
    { value: 75, label: 'Sand', muted: true },
    { value: 88, label: 'Gold', muted: true, chroma: 0.7 },
    { value: 120, label: 'Moss', muted: true },
    { value: 155, label: 'Sage', muted: true },
    { value: 190, label: 'Sea glass', muted: true },
    { value: 210, label: 'Petrol', muted: true, chroma: 0.6 },
    { value: 230, label: 'Steel', muted: true },
    { value: 255, label: 'Slate', muted: true },
    { value: 285, label: 'Lavender', muted: true },
    { value: 315, label: 'Plum', muted: true },
    { value: 345, label: 'Mauve', muted: true },
];

export const DEFAULT_TINT = null;

export function isTint(value: unknown): value is number | null {
    return TINT_CHOICES.some(choice => choice.value === value);
}

export function tintChroma(value: number | null): number {
    if (value === null) {
        return 0;
    }
    const choice = TINT_CHOICES.find(candidate => candidate.value === value);
    return choice?.chroma ?? (choice?.muted ? MUTED_CHROMA : 1);
}
