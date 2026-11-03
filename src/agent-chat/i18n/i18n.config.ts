export default defineI18nConfig(() => ({
    fallbackLocale: 'en',
    // English text is the key itself, so a missing translation shows the English text instead of a warning.
    fallbackFormat: true,
    missingWarn: false,
    fallbackWarn: false,
    messageResolver: (messages: unknown, key: string) => (messages as Record<string, string>)[key] ?? null,
}));
