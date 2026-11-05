import type { InjectionKey, Ref } from 'vue';

export interface BlockPicks {
    messageId: Ref<string | null>;
    draft: Ref<string>;
    reply: (messageId: string) => string | undefined;
    pick: (line: string, siblings: string[]) => void;
}

export const blockPicksKey: InjectionKey<BlockPicks> = Symbol('blockPicks');

export function useBlockPicks(): BlockPicks {
    return inject(blockPicksKey, { messageId: ref(null), draft: ref(''), reply: () => undefined, pick: () => {} });
}

export function pickLine(letter: string, title: string): string {
    return `${letter}) ${title}`;
}

export function firstLine(text: string): string {
    return text.trimStart().split('\n', 1)[0]!.trim();
}
