<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';

const props = defineProps<{
    message: ChatMessage;
}>();

const files = computed(() => turnFileChanges(props.message).files);
</script>

<template>
    <TransitionGroup
        :key="message.id"
        tag="div"
        class="flex flex-col"
        enter-active-class="transition-[grid-template-rows,opacity] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]"
        enter-from-class="[--rows:0fr] opacity-0"
        leave-active-class="transition-[grid-template-rows,opacity] duration-200 ease-in"
        leave-to-class="[--rows:0fr] opacity-0"
        move-class="transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]"
    >
        <div v-for="(file, index) in files" :key="file.path" class="grid grid-rows-[var(--rows,1fr)]">
            <div class="min-h-0 overflow-hidden">
                <ChatFileDiff :change="file" :class="index > 0 ? 'pt-4' : ''" />
            </div>
        </div>
    </TransitionGroup>
</template>
