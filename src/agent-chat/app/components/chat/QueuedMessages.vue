<script setup lang="ts">
import type { QueuedMessage } from '#shared/types/conversation';

const props = defineProps<{
    messages: QueuedMessage[];
    recipientName: (agentId: string) => string;
}>();

const title = computed(() => props.messages.length === 1 ? '1 message queued' : `${props.messages.length} messages queued`);

const rows = computed(() => props.messages.map((message) => {
    const files = message.parts.filter(part => part.type === 'file').length;
    return {
        ref: message.ref,
        recipient: props.recipientName(message.agentId),
        text: message.parts.flatMap(part => part.type === 'text' ? [part.text] : []).join(' ').replace(/\s+/g, ' ').trim(),
        files: files === 0 ? '' : files === 1 ? '1 file' : `${files} files`,
    };
}));
</script>

<template>
    <ChatActivityBox :title="title" :active="false" always-open :auto-open="true" icon="i-heroicons-queue-list">
        <ul class="flex max-h-48 flex-col gap-1 overflow-y-auto pe-1">
            <li v-for="row in rows" :key="row.ref" class="flex items-baseline gap-3 text-sm">
                <span class="shrink-0 font-medium text-toned">{{ row.recipient }}</span>
                <span class="min-w-0 flex-1 truncate text-default">{{ row.text }}</span>
                <span v-if="row.files" class="shrink-0 text-muted">{{ row.files }}</span>
            </li>
        </ul>
    </ChatActivityBox>
</template>
