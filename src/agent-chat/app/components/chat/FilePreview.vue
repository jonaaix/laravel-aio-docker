<script setup lang="ts">
import type { FilePreview } from '~/utils/file-kind';

const MAX_PREVIEW_BYTES = 1024 * 1024;

const open = defineModel<boolean>('open', { required: true });

const props = defineProps<{
    url: string;
    filename: string;
    details: string;
    preview: FilePreview;
    size: number | null;
}>();

const content = ref<string | null>(null);
const failed = ref(false);
const tooLarge = computed(() => props.size !== null && props.size > MAX_PREVIEW_BYTES);

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
                title="Too large to preview"
                description="Download the file to open it."
                icon="i-heroicons-information-circle"
                color="neutral"
                variant="subtle"
            />
            <UAlert
                v-else-if="failed"
                title="The file could not be loaded"
                icon="i-heroicons-exclamation-triangle"
                color="error"
                variant="subtle"
                :actions="[{ label: 'Retry', color: 'neutral', variant: 'outline', onClick: load }]"
            />
            <div v-else-if="content === null" class="flex flex-col gap-2">
                <USkeleton v-for="line in 12" :key="line" class="h-4 rounded-md" :class="line % 3 === 0 ? 'w-2/3' : 'w-full'" />
            </div>
            <Markdown v-else :value="markdown" :plugins="markdownPlugins" class="*:first:mt-0 *:last:mb-0" />
        </template>

        <template #footer>
            <UButton :to="url" :download="filename" external icon="i-heroicons-arrow-down-tray" label="Download" color="neutral" variant="outline" />
        </template>
    </USlideover>
</template>
