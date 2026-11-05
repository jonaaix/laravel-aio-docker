<script setup lang="ts">
import type { UiOption } from '#shared/types/ui-block';

const props = defineProps<{
    options: UiOption[];
    recommended: string | null;
    messageId: string;
    multiple?: boolean;
}>();

const { t } = useI18n();
const chatPlugins = useChatMarkdownPlugins();
const { active, answered, chosen, isChosen, pick } = useOptionPick(() => props.options, () => props.messageId, () => props.multiple);

const expanded = ref(false);
const collapsed = computed(() => answered.value && !expanded.value);
const shownIndexes = computed(() => props.options.flatMap((_, index) => !collapsed.value || isChosen(index) ? [index] : []));
</script>

<template>
    <p v-if="collapsed && chosen.length === 0" class="text-sm text-muted">
        {{ t('Not answered') }}
    </p>
    <div v-if="shownIndexes.length > 0" class="-mx-2 flex flex-col">
        <ChatOptionRow
            v-for="index in shownIndexes"
            :key="options[index]!.letter"
            :letter="options[index]!.letter"
            :selected="isChosen(index)"
            :disabled="!active"
            @pick="pick(index)"
        >
            <span class="flex flex-wrap items-center gap-x-2 font-medium text-highlighted">
                {{ options[index]!.title }}
                <span v-if="options[index]!.letter === recommended" class="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <UIcon name="i-heroicons-star-solid" class="size-3.5" />
                    {{ t('Recommended') }}
                </span>
            </span>
            <Markdown v-if="options[index]!.description" :value="options[index]!.description!" :plugins="chatPlugins" class="text-muted *:my-0" />
        </ChatOptionRow>
    </div>
    <UButton
        v-if="answered"
        :label="expanded ? t('Show less') : t('Show all options')"
        :trailing-icon="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
        color="neutral"
        variant="link"
        size="sm"
        class="self-start px-0"
        @click="expanded = !expanded"
    />
</template>
