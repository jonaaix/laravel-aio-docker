import type { ThemedToken } from 'shiki/core';

export function fileLanguage(path: string): string | null {
    const name = path.split('/').pop() ?? '';
    if (name.endsWith('.blade.php')) {
        return 'blade';
    }
    if (name === 'Dockerfile') {
        return 'dockerfile';
    }
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : null;
}

const FILE_EXTENSION = /\.([a-z]\w{0,4})(?=$|[\s'"`|;&)<>:,])/gi;

export function commandLanguage(command: string): string | null {
    return [...command.matchAll(FILE_EXTENSION)].at(-1)?.[1]?.toLowerCase() ?? null;
}

export function useCodeTokens(code: MaybeRefOrGetter<string>, language: MaybeRefOrGetter<string | null>): Readonly<Ref<ThemedToken[][] | null>> {
    const tokens = shallowRef<ThemedToken[][] | null>(null);

    watch([() => toValue(code), () => toValue(language)], async ([text, name], _previous, onCleanup) => {
        let current = true;
        onCleanup(() => {
            current = false;
        });
        if (import.meta.server || !text) {
            tokens.value = null;
            return;
        }
        const { highlightLines } = await import('~/utils/code-highlight');
        const result = await highlightLines(text, name).catch(() => null);
        if (current) {
            tokens.value = result;
        }
    }, { immediate: true });

    return tokens;
}
