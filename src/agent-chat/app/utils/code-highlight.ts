import { getHighlighter } from '@comark/nuxt/plugins/shiki';
import { codeToTokens } from 'shiki/core';
import type { ThemedToken } from 'shiki/core';
import { bundledLanguages, bundledLanguagesInfo } from 'shiki/langs';
import type { BundledLanguage } from 'shiki/langs';
import { codeThemes } from './code-languages';

function resolveLanguage(name: string): BundledLanguage | null {
    const info = bundledLanguagesInfo.find(language => language.id === name || language.aliases?.includes(name));
    return info ? info.id as BundledLanguage : null;
}

const BASIC_LANGUAGE: BundledLanguage = 'log';

export async function highlightLines(code: string, language: string | string[] | null): Promise<ThemedToken[][] | null> {
    const id = [language ?? []].flat().map(resolveLanguage).find(Boolean) ?? BASIC_LANGUAGE;
    const grammar = (await bundledLanguages[id]()).default;
    const highlighter = await getHighlighter({ themes: codeThemes, languages: [grammar], registerDefaultThemes: false });
    return codeToTokens(highlighter, code, { lang: id, themes: codeThemes }).tokens;
}
