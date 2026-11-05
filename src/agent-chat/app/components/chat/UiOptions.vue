<script setup lang="ts">
import type { UiOption } from '#shared/types/ui-block';

const props = defineProps<{
    options: UiOption[];
    recommended: string | null;
    messageId: string;
}>();

const { t } = useI18n();
const chatPlugins = useChatMarkdownPlugins();
const { active, isChosen, pick } = useOptionPick(() => props.options, () => props.messageId);
</script>

<template>
    <div class="-mx-2 flex flex-col">
        <ChatOptionRow
            v-for="(option, index) in options"
            :key="option.letter"
            :letter="option.letter"
            :selected="isChosen(index)"
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
