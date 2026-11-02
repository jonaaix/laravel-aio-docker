export interface FontChoice {
    value: string;
    label: string;
    stack: string;
}

export const FONT_CHOICES: FontChoice[] = [
    { value: 'system', label: 'System UI', stack: 'system-ui, -apple-system, \'Segoe UI\', Roboto, sans-serif' },
    { value: 'geist', label: 'Geist', stack: '\'Geist\', ui-sans-serif, system-ui, sans-serif' },
    { value: 'inter', label: 'Inter', stack: '\'Inter\', ui-sans-serif, system-ui, sans-serif' },
    { value: 'source-sans', label: 'Source Sans 3', stack: '\'Source Sans 3\', ui-sans-serif, system-ui, sans-serif' },
    { value: 'ibm-plex-sans', label: 'IBM Plex Sans', stack: '\'IBM Plex Sans\', ui-sans-serif, system-ui, sans-serif' },
];

export const DEFAULT_FONT = 'system';

export const COLOR_MODES = ['light', 'dark', 'system'] as const;

export type ColorModeChoice = typeof COLOR_MODES[number];

export function fontStack(value: string | null | undefined): string {
    return (FONT_CHOICES.find(choice => choice.value === value) ?? FONT_CHOICES.find(choice => choice.value === DEFAULT_FONT)!).stack;
}
