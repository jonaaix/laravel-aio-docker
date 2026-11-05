import type { UiOption } from '#shared/types/ui-block';
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

export function useOptionPick(options: () => UiOption[], messageId: () => string) {
    const picks = useBlockPicks();
    const lines = computed(() => options().map(option => pickLine(option.letter, option.title)));
    const active = computed(() => picks.messageId.value === messageId());
    const chosenLine = computed(() => {
        const text = active.value ? picks.draft.value : picks.reply(messageId());
        return text === undefined ? null : firstLine(text);
    });

    function isChosen(index: number): boolean {
        return chosenLine.value === lines.value[index];
    }

    function pick(index: number): void {
        picks.pick(lines.value[index]!, lines.value);
    }

    return { active, isChosen, pick };
}
