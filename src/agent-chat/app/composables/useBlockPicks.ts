import type { UiOption } from '#shared/types/ui-block';
import type { InjectionKey, Ref } from 'vue';

export type OwnsLine = (line: string) => boolean;

export interface BlockPicks {
    messageId: Ref<string | null>;
    draft: Ref<string>;
    reply: (messageId: string) => string | undefined;
    pick: (line: string, ownsLine: OwnsLine) => void;
    unpick: (ownsLine: OwnsLine) => void;
}

export const blockPicksKey: InjectionKey<BlockPicks> = Symbol('blockPicks');

const PICK_SEPARATOR = ', ';

export function useBlockPicks(): BlockPicks {
    return inject(blockPicksKey, { messageId: ref(null), draft: ref(''), reply: () => undefined, pick: () => {}, unpick: () => {} });
}

export function pickLine(letter: string, title: string): string {
    return `${letter}) ${title}`;
}

export function firstLine(text: string): string {
    return text.trimStart().split('\n', 1)[0]!.trim();
}

export function useOptionPick(options: () => UiOption[], messageId: () => string, multiple: () => boolean = () => false) {
    const picks = useBlockPicks();
    const lines = computed(() => options().map(option => pickLine(option.letter, option.title)));
    const active = computed(() => picks.messageId.value === messageId());

    function chosenIn(line: string): number[] {
        const chosen = lines.value.flatMap((option, index) => line.includes(option) ? [index] : []);
        return chosen.length > 0 && chosen.map(index => lines.value[index]).join(PICK_SEPARATOR) === line ? chosen : [];
    }

    const ownsLine: OwnsLine = line => chosenIn(line).length > 0;

    const reply = computed(() => (active.value ? undefined : picks.reply(messageId())));
    const answered = computed(() => reply.value !== undefined);
    const chosen = computed(() => {
        const text = active.value ? picks.draft.value : reply.value;
        return text === undefined ? [] : chosenIn(firstLine(text));
    });

    function isChosen(index: number): boolean {
        return chosen.value.includes(index);
    }

    function pick(index: number): void {
        const next = multiple()
            ? (isChosen(index) ? chosen.value.filter(other => other !== index) : [...chosen.value, index]).sort((a, b) => a - b)
            : (isChosen(index) ? [] : [index]);
        if (next.length === 0) {
            picks.unpick(ownsLine);
            return;
        }
        picks.pick(next.map(other => lines.value[other]).join(PICK_SEPARATOR), ownsLine);
    }

    return { active, answered, chosen, isChosen, pick };
}
