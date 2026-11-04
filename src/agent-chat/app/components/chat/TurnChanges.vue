<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';

const props = defineProps<{
    message: ChatMessage;
    shown: boolean;
}>();

const emit = defineEmits<{ show: [] }>();

const changesTitle = useChangesTitle();
const files = computed(() => turnFileChanges(props.message).files);
</script>

<template>
    <button
        v-if="files.length > 0"
        type="button"
        class="group flex h-7 max-w-full items-center gap-2 text-start text-sm"
        @click="emit('show')"
    >
        <UIcon name="i-heroicons-document-duplicate" class="size-4 shrink-0" :class="shown ? 'text-primary' : 'text-muted'" />
        <span class="font-medium" :class="shown ? 'text-primary' : 'text-default group-hover:text-primary'">{{ changesTitle(files) }}</span>
        <UIcon name="i-heroicons-chevron-right" class="size-4 shrink-0 text-muted" />
    </button>
</template>
