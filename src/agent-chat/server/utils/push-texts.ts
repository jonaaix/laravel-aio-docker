import en from '../../i18n/locales/en.json' with { type: 'json' };
import de from '../../i18n/locales/de.json' with { type: 'json' };
import fr from '../../i18n/locales/fr.json' with { type: 'json' };
import nl from '../../i18n/locales/nl.json' with { type: 'json' };
import es from '../../i18n/locales/es.json' with { type: 'json' };
import it from '../../i18n/locales/it.json' with { type: 'json' };

const TRANSLATED: Record<string, Record<string, string>> = { en, de, fr, nl, es, it };

export function serverText(key: string, language: string | null): string {
    return TRANSLATED[language ?? '']?.[key] ?? key;
}
