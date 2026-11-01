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

const open = ref(false);
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
            v-model:open="open"
            :text="part.toolName"
            :suffix="toolLabel"
            :loading="toolRunning"
            :icon="toolIcon"
            :ui="{ leadingIcon: part.state === 'output-error' ? 'text-error' : '' }"
        >
            <div class="space-y-2 text-xs">
                <pre v-if="toolCommand" class="max-h-64 overflow-auto rounded-md bg-elevated p-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{{ toolCommand }}</pre>
                <pre
                    v-if="toolOutput"
                    class="max-h-96 overflow-auto rounded-md p-3 whitespace-pre-wrap"
                    :class="part.state === 'output-error' ? 'bg-error/10 text-error' : 'bg-elevated'"
                >{{ toolOutput }}</pre>
            </div>
        </UChatTool>
        <pre
            v-if="showCommand && toolCommand && !open"
            class="mt-1 max-h-64 overflow-auto rounded-md bg-elevated p-3 text-xs whitespace-pre-wrap [overflow-wrap:anywhere]"
        >{{ toolCommand }}</pre>
    </div>

    <Markdown
        v-else-if="part.type === 'text' && message.role === 'assistant'"
        :value="part.text"
        :streaming="isPartStreaming(part) && streaming"
        class="*:first:mt-0 *:last:mb-0"
    />

    <p v-else-if="part.type === 'text'" class="whitespace-pre-wrap">{{ part.text }}</p>
</template>
