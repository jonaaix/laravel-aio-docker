<script setup lang="ts">
import { isPartStreaming, isToolStreaming } from '@nuxt/ui/utils/ai';
import type { ChatMessage, ChatPart } from '#shared/types/conversation';

const props = defineProps<{
    part: ChatPart;
    message: ChatMessage;
    streaming: boolean;
    open?: boolean;
}>();

const emit = defineEmits<{ 'update:open': [value: boolean] }>();

const toolRunning = computed(() => props.part.type === 'dynamic-tool' && props.streaming && isToolStreaming(props.part));
const toolIcon = computed(() => {
    if (props.part.type === 'dynamic-tool' && props.part.state === 'output-error') {
        return 'i-heroicons-x-circle';
    }
    return 'i-heroicons-check';
});

const toolInput = computed(() => props.part.type === 'dynamic-tool' ? toolDetail(props.part.input) : '');
const toolOutput = computed(() => {
    if (props.part.type !== 'dynamic-tool') {
        return '';
    }
    if (props.part.state === 'output-error') {
        return props.part.errorText;
    }
    return props.part.state === 'output-available' ? toolDetail(props.part.output) : '';
});
</script>

<template>
    <UChatTool
        v-if="part.type === 'dynamic-tool'"
        :text="part.toolName"
        :suffix="toolSummary(part.input)"
        :loading="toolRunning"
        :icon="toolIcon"
        :open="open"
        :ui="{ leadingIcon: part.state === 'output-error' ? 'text-error' : '' }"
        @update:open="emit('update:open', $event)"
    >
        <div class="space-y-2 text-xs">
            <pre v-if="toolInput" class="max-h-64 overflow-auto rounded-md bg-elevated p-3 whitespace-pre-wrap">{{ toolInput }}</pre>
            <pre
                v-if="toolOutput"
                class="max-h-96 overflow-auto rounded-md p-3 whitespace-pre-wrap"
                :class="part.state === 'output-error' ? 'bg-error/10 text-error' : 'bg-elevated'"
            >{{ toolOutput }}</pre>
        </div>
    </UChatTool>

    <Markdown
        v-else-if="part.type === 'text' && message.role === 'assistant'"
        :value="part.text"
        :streaming="isPartStreaming(part) && streaming"
        class="*:first:mt-0 *:last:mb-0"
    />

    <p v-else-if="part.type === 'text'" class="whitespace-pre-wrap">{{ part.text }}</p>
</template>
