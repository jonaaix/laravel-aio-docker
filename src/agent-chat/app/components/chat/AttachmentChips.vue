<script setup lang="ts">
import type { PendingAttachment } from '~/composables/useAttachments';

defineProps<{
    attachments: PendingAttachment[];
}>();

const emit = defineEmits<{ remove: [key: string] }>();
</script>

<template>
    <ul class="flex flex-wrap gap-2 px-1 pt-1">
        <li
            v-for="attachment in attachments"
            :key="attachment.key"
            class="flex h-12 max-w-64 items-center gap-2.5 rounded-md bg-elevated/60 py-1.5 ps-1.5 pe-1 ring ring-default"
            :class="attachment.error ? 'ring-error/40' : ''"
        >
            <img v-if="attachment.previewUrl" :src="attachment.previewUrl" alt="" class="size-9 shrink-0 rounded-lg object-cover">
            <span v-else class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-default">
                <UIcon :name="fileIcon(attachment.filename)" class="size-5 text-muted" />
            </span>
            <span class="flex min-w-0 flex-col">
                <span class="truncate text-sm text-highlighted">{{ attachment.filename }}</span>
                <span class="truncate text-xs tabular-nums" :class="attachment.error ? 'text-error' : 'text-muted'">
                    {{ attachment.error ?? (attachment.upload ? formatBytes(attachment.size) : 'Uploading…') }}
                </span>
            </span>
            <UIcon v-if="!attachment.upload && !attachment.error" name="i-heroicons-arrow-path" class="size-4 shrink-0 animate-spin text-muted" />
            <UTooltip text="Remove">
                <UButton
                    icon="i-heroicons-x-mark"
                    aria-label="Remove"
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    class="shrink-0"
                    @click="emit('remove', attachment.key)"
                />
            </UTooltip>
        </li>
    </ul>
</template>
