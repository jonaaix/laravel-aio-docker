<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';

defineProps<{ message: ChatMessage }>();
</script>

<template>
    <p v-if="message.metadata?.outcome === 'stopped'" class="mt-3 flex items-center gap-1.5 text-sm text-muted">
        <UIcon name="i-heroicons-stop-circle" class="size-4 shrink-0" />
        Stopped
    </p>
    <div
        v-else-if="message.metadata?.outcome === 'failed'"
        class="mt-3 flex gap-2 rounded-md bg-error/10 p-3 text-sm text-error ring ring-error/25"
    >
        <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 size-4 shrink-0" />
        <div class="min-w-0">
            <p class="font-medium">Failed</p>
            <p v-if="message.metadata.error" class="whitespace-pre-wrap [overflow-wrap:anywhere]">{{ message.metadata.error }}</p>
        </div>
    </div>
</template>
