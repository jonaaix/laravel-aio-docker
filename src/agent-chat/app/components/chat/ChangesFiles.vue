<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';

const props = defineProps<{
    message: ChatMessage;
}>();

const files = computed(() => turnFileChanges(props.message).files);
</script>

<template>
    <div class="flex flex-col gap-4">
        <ChatFileDiff v-for="file in files" :key="file.path" :change="file" />
    </div>
</template>
