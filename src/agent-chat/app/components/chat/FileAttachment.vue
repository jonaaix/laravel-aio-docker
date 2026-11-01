<script setup lang="ts">
import type { FileUIPart } from 'ai';

const props = defineProps<{ part: FileUIPart }>();

const filename = computed(() => props.part.filename ?? 'File');
const url = computed(() => apiUrl(props.part.url));
const size = computed(() => {
    const value = props.part.providerMetadata?.agentChat?.size;
    return typeof value === 'number' ? value : null;
});
const details = computed(() => [
    fileExtension(filename.value).toUpperCase() || 'File',
    size.value === null ? null : formatBytes(size.value),
].filter(Boolean).join(' · '));
const preview = computed(() => filePreview(filename.value));
const previewOpen = ref(false);

function openPreview(): void {
    if (preview.value) {
        previewOpen.value = true;
    }
}
</script>

<template>
    <div
        :role="preview ? 'button' : undefined"
        :tabindex="preview ? 0 : undefined"
        :aria-label="preview ? `Preview ${filename}` : undefined"
        class="my-3 flex w-full max-w-md items-center gap-3 rounded-xl bg-elevated/40 p-3 ring ring-default transition-colors"
        :class="preview ? 'cursor-pointer hover:bg-elevated focus-visible:outline-2 focus-visible:outline-primary' : ''"
        @click="openPreview"
        @keydown.enter.prevent="openPreview"
        @keydown.space.prevent="openPreview"
    >
        <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon :name="fileIcon(filename)" class="size-5" />
        </span>
        <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-highlighted [overflow-wrap:anywhere]">{{ filename }}</span>
            <span class="block text-xs text-muted tabular-nums">{{ details }}</span>
        </span>
        <UButton
            :to="url"
            :download="filename"
            external
            icon="i-heroicons-arrow-down-tray"
            label="Download"
            color="neutral"
            variant="outline"
            class="shrink-0"
            @click.stop
        />
    </div>

    <ChatFilePreview
        v-if="preview"
        v-model:open="previewOpen"
        :url="url"
        :filename="filename"
        :details="details"
        :preview="preview"
        :size="size"
    />
</template>
