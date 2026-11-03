export interface LanguageChoice {
    code: string;
    name: string;
}

export const LANGUAGES: LanguageChoice[] = [
    { code: 'en', name: 'English' },
    { code: 'de', name: 'Deutsch' },
    { code: 'fr', name: 'Français' },
    { code: 'nl', name: 'Nederlands' },
    { code: 'es', name: 'Español' },
    { code: 'it', name: 'Italiano' },
];

export const DEFAULT_LANGUAGE = 'en';

export function isLanguage(value: unknown): value is string {
    return LANGUAGES.some(language => language.code === value);
}
