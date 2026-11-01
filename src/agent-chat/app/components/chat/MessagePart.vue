<script setup lang="ts">
import { isPartStreaming, isToolStreaming } from '@nuxt/ui/utils/ai';
import type { ChatMessage, ChatPart } from '#shared/types/conversation';

const props = defineProps<{
    part: ChatPart;
    message: ChatMessage;
    streaming: boolean;
    showCommand?: boolean;
}>();

const toolLabel = computed(() => props.part.type === 'dynamic-tool' ? toolDescription(props.part.input) : '');
const toolCommand = computed(() => {
    const command = props.part.type === 'dynamic-tool' ? toolSummary(props.part.input) : '';
    return command !== toolLabel.value ? command : '';
});

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
    <div v-if="part.type === 'dynamic-tool'">
        <UChatTool
            :text="part.toolName"
            :suffix="toolLabel"
            :loading="toolRunning"
            :icon="toolIcon"
            :ui="{ leadingIcon: part.state === 'output-error' ? 'text-error' : '' }"
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
        <p v-if="showCommand && toolCommand" class="mt-0.5 ps-6 font-mono text-xs leading-5 whitespace-pre-wrap text-muted [overflow-wrap:anywhere]">{{ toolCommand }}</p>
    </div>

    <Markdown
        v-else-if="part.type === 'text' && message.role === 'assistant'"
        :value="part.text"
        :streaming="isPartStreaming(part) && streaming"
        class="*:first:mt-0 *:last:mb-0"
    />

    <p v-else-if="part.type === 'text'" class="whitespace-pre-wrap">{{ part.text }}</p>
</template>
