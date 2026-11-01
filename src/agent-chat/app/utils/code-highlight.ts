import { getHighlighter } from '@comark/nuxt/plugins/shiki';
import { codeToTokens } from 'shiki/core';
import type { ThemedToken } from 'shiki/core';
import { bundledLanguages, bundledLanguagesInfo } from 'shiki/langs';
import type { BundledLanguage } from 'shiki/langs';
import { codeThemes } from './markdown-plugins';

function resolveLanguage(name: string): BundledLanguage | null {
    const info = bundledLanguagesInfo.find(language => language.id === name || language.aliases?.includes(name));
    return info ? info.id as BundledLanguage : null;
}

export async function highlightLines(code: string, language: string): Promise<ThemedToken[][] | null> {
    const id = resolveLanguage(language);
    if (!id) {
        return null;
    }
    const grammar = (await bundledLanguages[id]()).default;
    const highlighter = await getHighlighter({ themes: codeThemes, languages: [grammar], registerDefaultThemes: false });
    return codeToTokens(highlighter, code, { lang: id, themes: codeThemes }).tokens;
}
