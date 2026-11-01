<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';
import type { DynamicToolUIPart } from 'ai';

const VISIBLE_STEPS = 5;

const props = defineProps<{
    message: ChatMessage;
    streaming: boolean;
}>();

const tools = computed(() => props.message.parts.filter((part): part is DynamicToolUIPart => part.type === 'dynamic-tool'));
const working = computed(() => props.streaming && props.message.parts.at(-1)?.type !== 'text');
const failed = computed(() => tools.value.some(part => part.state === 'output-error'));
const title = computed(() => {
    if (working.value) {
        return 'Working…';
    }
    return tools.value.length === 1 ? 'Worked · 1 step' : `Worked · ${tools.value.length} steps`;
});

const listedTools = computed(() => tools.value.filter(part => part.input !== undefined));
const showAll = ref(false);
const hiddenCount = computed(() => showAll.value ? 0 : Math.max(0, listedTools.value.length - VISIBLE_STEPS));
const visibleTools = computed(() => listedTools.value.slice(hiddenCount.value));
const commandTool = computed(() => working.value ? listedTools.value.findLast(part => toolSummary(part.input) !== '') : undefined);
</script>

<template>
    <ChatActivityBox
        v-if="tools.length > 0"
        :title="title"
        :active="working"
        :icon="failed ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-wrench-screwdriver'"
        :icon-class="failed ? 'text-error' : ''"
    >
        <div v-if="listedTools.length > 0" class="mt-1 flex flex-col gap-1">
            <UButton
                v-if="listedTools.length > VISIBLE_STEPS"
                :label="showAll ? 'Show fewer steps' : hiddenCount === 1 ? 'Show 1 earlier step' : `Show ${hiddenCount} earlier steps`"
                :icon="showAll ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'"
                color="neutral"
                variant="link"
                size="xs"
                class="self-start px-0"
                @click="showAll = !showAll"
            />
            <ChatMessagePart
                v-for="part in visibleTools"
                :key="part.toolCallId"
                :part="part"
                :message="message"
                :streaming="streaming"
                :show-command="part === commandTool"
            />
        </div>
    </ChatActivityBox>
</template>
