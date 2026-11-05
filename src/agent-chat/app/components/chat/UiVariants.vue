<script setup lang="ts">
import type { UiVariant, UiVariantColumns, UiViewport } from '#shared/types/ui-block';

const props = defineProps<{
    title: string | null;
    options: UiVariant[];
    columns: UiVariantColumns;
    viewport: UiViewport;
    recommended: string | null;
    messageId: string;
    multiple?: boolean;
}>();

const { t } = useI18n();
const chatPlugins = useChatMarkdownPlugins();
const { active, isChosen, pick } = useOptionPick(() => props.options, () => props.messageId, () => props.multiple);

const viewedIndex = ref<number | null>(null);
const viewed = computed(() => (viewedIndex.value === null ? null : props.options[viewedIndex.value] ?? null));
const viewerOpen = computed({
    get: () => viewedIndex.value !== null,
    set: (open) => {
        if (!open) {
            viewedIndex.value = null;
        }
    },
});

function choose(index: number): void {
    if (active.value) {
        pick(index);
    }
}
</script>

<template>
    <div :role="multiple ? 'group' : 'radiogroup'" :aria-label="title ?? undefined" class="grid gap-3" :class="{ 'sm:grid-cols-2': columns === 2 }">
        <div
            v-for="(option, index) in options"
            :key="option.letter"
            :role="multiple ? 'checkbox' : 'radio'"
            :aria-checked="isChosen(index)"
            :aria-disabled="!active"
            :tabindex="active ? 0 : -1"
            class="flex min-w-0 flex-col gap-2.5 rounded-md p-3 transition-colors duration-500 ease-out"
            :class="[
                isChosen(index) ? 'bg-primary/5 ring-2 ring-primary dark:bg-primary/15' : 'ring ring-default',
                active ? 'cursor-pointer hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary dark:hover:bg-primary/10' : '',
            ]"
            @click="choose(index)"
            @keydown.enter.prevent="choose(index)"
            @keydown.space.prevent="choose(index)"
        >
            <div class="flex items-start gap-2">
                <!-- Fixed radius: rounded-md is 12px in this chat and would turn the 24px key cap into a circle. -->
                <span
                    class="flex size-6 shrink-0 items-center justify-center rounded-[0.375rem] text-xs font-semibold uppercase transition-colors duration-500 ease-out"
                    :class="isChosen(index) ? 'bg-primary text-inverted' : 'bg-default text-muted shadow-[0_1px_0_var(--ui-border-accented)] ring ring-accented'"
                >{{ option.letter }}</span>
                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div class="flex items-start gap-2">
                        <span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 font-medium text-highlighted">
                            <span>{{ option.title }}</span>
                            <UBadge v-if="option.letter === recommended" :label="t('Recommended')" icon="i-heroicons-star-solid" color="primary" variant="solid" size="sm" />
                        </span>
                        <UTooltip :text="t('View larger')">
                            <UButton icon="i-heroicons-arrows-pointing-out" color="neutral" variant="ghost" class="-my-1 size-7 shrink-0 justify-center p-0" :aria-label="t('View larger')" @click.stop="viewedIndex = index" />
                        </UTooltip>
                    </div>
                    <Markdown v-if="option.description" :value="option.description" :plugins="chatPlugins" class="text-sm text-muted *:my-0" />
                </div>
            </div>
            <ChatPreviewFrame :src="apiUrl(option.page.url)" :title="option.title" :height="viewport.height" class="rounded-sm ring ring-default" @click.stop />
        </div>
    </div>

    <ChatPageViewer
        v-if="viewed"
        v-model:open="viewerOpen"
        :src="apiUrl(viewed.page.url)"
        :file-url="apiUrl(viewed.page.fileUrl)"
        :filename="viewed.page.filename"
        :created-at="viewed.page.createdAt"
        :title="`${viewed.letter}) ${viewed.title}`"
        :has-previous="viewedIndex! > 0"
        :has-next="viewedIndex! < options.length - 1"
        @previous="viewedIndex = viewedIndex! - 1"
        @next="viewedIndex = viewedIndex! + 1"
    />
</template>
