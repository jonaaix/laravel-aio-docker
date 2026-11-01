<script setup lang="ts">
import type { FileUIPart } from 'ai';

const props = defineProps<{ part: FileUIPart }>();

const filename = computed(() => props.part.filename ?? 'File');
const size = computed(() => {
    const value = props.part.providerMetadata?.agentChat?.size;
    return typeof value === 'number' ? formatBytes(value) : null;
});
const details = computed(() => [fileExtension(filename.value).toUpperCase() || 'File', size.value].filter(Boolean).join(' · '));
</script>

<template>
    <a
        :href="apiUrl(part.url)"
        :download="filename"
        class="group my-3 flex w-full max-w-md items-center gap-3 rounded-xl bg-elevated/40 p-3 ring ring-default transition-colors hover:bg-elevated"
    >
        <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UIcon :name="fileIcon(filename)" class="size-5" />
        </span>
        <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-highlighted [overflow-wrap:anywhere]">{{ filename }}</span>
            <span class="block text-xs text-muted tabular-nums">{{ details }}</span>
        </span>
        <span class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-default ring ring-default group-hover:bg-default">
            <UIcon name="i-heroicons-arrow-down-tray" class="size-4" />
            Download
        </span>
    </a>
</template>
