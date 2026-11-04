const MIN_HITS = 3;

const COMMON_WORDS: Record<string, Set<string>> = {
    en: new Set(['the', 'and', 'is', 'are', 'to', 'of', 'that', 'it', 'you', 'for', 'with', 'this', 'not', 'be', 'on', 'was', 'have', 'what', 'can']),
    de: new Set(['der', 'die', 'das', 'und', 'ist', 'nicht', 'ich', 'du', 'ein', 'eine', 'zu', 'mit', 'auf', 'für', 'den', 'sie', 'es', 'wir', 'sind', 'auch']),
    fr: new Set(['le', 'les', 'et', 'est', 'des', 'une', 'pas', 'que', 'qui', 'pour', 'dans', 'vous', 'je', 'sur', 'ce', 'avec', 'du', 'au']),
    nl: new Set(['het', 'een', 'en', 'niet', 'dat', 'van', 'ik', 'je', 'zijn', 'met', 'voor', 'op', 'wat', 'maar', 'ook', 'naar', 'deze']),
    es: new Set(['el', 'los', 'las', 'y', 'es', 'que', 'no', 'una', 'por', 'para', 'con', 'se', 'lo', 'está', 'como', 'pero', 'del']),
    it: new Set(['il', 'che', 'è', 'di', 'non', 'una', 'per', 'con', 'sono', 'gli', 'si', 'della', 'ho', 'anche', 'come', 'questo', 'nel']),
};

export function guessLanguage(text: string, fallback: string): string {
    const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
    let best = fallback;
    let bestHits = MIN_HITS - 1;
    for (const [language, common] of Object.entries(COMMON_WORDS)) {
        const hits = words.filter(word => common.has(word)).length;
        if (hits > bestHits) {
            best = language;
            bestHits = hits;
        }
    }
    return best;
}
