<script setup lang="ts">
import type { UiOption } from '#shared/types/ui-block';

const props = defineProps<{
    options: UiOption[];
    recommended: string | null;
    messageId: string;
}>();

const { t } = useI18n();
const picks = useBlockPicks();
const chatPlugins = useChatMarkdownPlugins();

const lines = computed(() => props.options.map(option => pickLine(option.letter, option.title)));
const active = computed(() => picks.messageId.value === props.messageId);
const chosenLine = computed(() => {
    const text = active.value ? picks.draft.value : picks.reply(props.messageId);
    return text === undefined ? null : firstLine(text);
});

function pick(index: number): void {
    picks.pick(lines.value[index]!, lines.value);
}
</script>

<template>
    <div class="-mx-2 flex flex-col">
        <ChatOptionRow
            v-for="(option, index) in options"
            :key="option.letter"
            :letter="option.letter"
            :selected="chosenLine === lines[index]"
            :disabled="!active"
            @pick="pick(index)"
        >
            <span class="flex flex-wrap items-center gap-x-2 font-medium text-highlighted">
                {{ option.title }}
                <span v-if="option.letter === recommended" class="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <UIcon name="i-heroicons-star-solid" class="size-3.5" />
                    {{ t('Recommended') }}
                </span>
            </span>
            <Markdown v-if="option.description" :value="option.description" :plugins="chatPlugins" class="text-muted *:my-0" />
        </ChatOptionRow>
    </div>
</template>
