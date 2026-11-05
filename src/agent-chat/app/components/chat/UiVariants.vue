<script setup lang="ts">
import type { UiVariant, UiVariantColumns, UiViewport } from '#shared/types/ui-block';

const props = defineProps<{
    title: string | null;
    options: UiVariant[];
    columns: UiVariantColumns;
    viewport: UiViewport;
    recommended: string | null;
    messageId: string;
}>();

const { t } = useI18n();
const chatPlugins = useChatMarkdownPlugins();
const { active, isChosen, pick } = useOptionPick(() => props.options, () => props.messageId);

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
    <div role="radiogroup" :aria-label="title ?? undefined" class="grid gap-3" :class="{ 'sm:grid-cols-2': columns === 2 }">
        <div
            v-for="(option, index) in options"
            :key="option.letter"
            role="radio"
            :aria-checked="isChosen(index)"
            :aria-disabled="!active"
            :tabindex="active ? 0 : -1"
            class="flex min-w-0 flex-col gap-2.5 rounded-md p-3 transition-colors duration-500 ease-out"
            :class="[
                isChosen(index) ? 'bg-primary/5 ring-2 ring-primary' : 'ring ring-default',
                active ? 'cursor-pointer hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary' : '',
            ]"
            @click="choose(index)"
            @keydown.enter.prevent="choose(index)"
            @keydown.space.prevent="choose(index)"
        >
            <div class="flex items-start gap-2">
                <span class="mt-1 flex size-4 shrink-0 items-center justify-center rounded-full ring" :class="isChosen(index) ? 'ring-primary' : 'ring-accented'" aria-hidden="true">
                    <span v-if="isChosen(index)" class="size-2 rounded-full bg-primary" />
                </span>
                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span class="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-highlighted">
                        <span><span class="text-muted">{{ option.letter }})</span> {{ option.title }}</span>
                        <UBadge v-if="option.letter === recommended" :label="t('Recommended')" icon="i-heroicons-star-solid" color="primary" variant="solid" size="sm" />
                    </span>
                    <Markdown v-if="option.description" :value="option.description" :plugins="chatPlugins" class="text-sm text-muted *:my-0" />
                </div>
                <UTooltip :text="t('View larger')">
                    <UButton icon="i-heroicons-arrows-pointing-out" color="neutral" variant="ghost" class="size-7 shrink-0 justify-center p-0" :aria-label="t('View larger')" @click.stop="viewedIndex = index" />
                </UTooltip>
            </div>
            <ChatScaledFrame :src="apiUrl(option.page.url)" :title="option.title" :width="viewport.width" :height="viewport.height" class="rounded-sm ring ring-default" @click.stop />
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
