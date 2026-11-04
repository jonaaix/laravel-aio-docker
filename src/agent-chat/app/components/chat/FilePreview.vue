<script setup lang="ts">
import type { FilePreview } from '~/utils/file-kind';
import type { DiffLine } from '~/utils/line-diff';

const MAX_PREVIEW_BYTES = 1024 * 1024;

const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
    url: string;
    filename: string;
    details: string;
    preview: FilePreview;
    size: number | null;
    changedLines?: number[];
}>();

const { t } = useI18n();

const content = ref<string | null>(null);
const failed = ref(false);
const tooLarge = computed(() => props.size !== null && props.size > MAX_PREVIEW_BYTES);

const body = ref<HTMLElement | null>(null);

const changedSource = computed<DiffLine[] | null>(() => {
    if (content.value === null || !props.changedLines?.length) {
        return null;
    }
    const changed = new Set(props.changedLines);
    const lines = content.value.split('\n');
    if (lines.at(-1) === '') {
        lines.pop();
    }
    return lines.map((text, index) => ({ kind: changed.has(index + 1) ? 'added' : 'same', text, number: index + 1 }));
});

const sourceLanguage = computed(() => props.preview.kind === 'code' ? props.preview.language : 'markdown');

watch(changedSource, async (lines) => {
    if (!lines) {
        return;
    }
    await nextTick();
    body.value?.querySelector('[data-kind="added"]')?.scrollIntoView({ block: 'center' });
});

const markdown = computed(() => {
    if (content.value === null) {
        return '';
    }
    return props.preview.kind === 'markdown' ? content.value : fencedCode(content.value, props.preview.language);
});

async function load(): Promise<void> {
    failed.value = false;
    try {
        content.value = await $fetch<string>(props.url, { responseType: 'text' });
    }
    catch {
        failed.value = true;
    }
}

watch(open, (value) => {
    if (value && content.value === null && !tooLarge.value) {
        load();
    }
});
</script>

<template>
    <USlideover v-model:open="open" :title="filename" :description="details" :ui="{ content: 'sm:max-w-3xl' }">
        <template #body>
            <UAlert
                v-if="tooLarge"
                :title="t('Too large to preview')"
                :description="t('Download the file to open it.')"
                icon="i-heroicons-information-circle"
                color="neutral"
                variant="subtle"
            />
            <UAlert
                v-else-if="failed"
                :title="t('The file could not be loaded')"
                icon="i-heroicons-exclamation-triangle"
                color="error"
                variant="subtle"
                :actions="[{ label: t('Retry'), color: 'neutral', variant: 'outline', onClick: load }]"
            />
            <div v-else-if="content === null" class="flex flex-col gap-2">
                <USkeleton v-for="line in 12" :key="line" class="h-4 rounded-md" :class="line % 3 === 0 ? 'w-2/3' : 'w-full'" />
            </div>
            <div v-else-if="changedSource" ref="body">
                <ChatDiffLines :lines="changedSource" :language="sourceLanguage" />
            </div>
            <Markdown v-else :value="markdown" :plugins="markdownPlugins" class="*:first:mt-0 *:last:mb-0" />
        </template>

        <template #footer>
            <UButton :to="url" :download="filename" external icon="i-heroicons-arrow-down-tray" :label="t('Download')" color="neutral" variant="outline" />
        </template>
    </USlideover>
</template>
