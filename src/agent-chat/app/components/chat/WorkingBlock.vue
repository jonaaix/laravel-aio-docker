<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';
import type { DynamicToolUIPart } from 'ai';

const VISIBLE_STEPS = 5;

const props = defineProps<{
    message: ChatMessage;
    streaming: boolean;
    fileChangesShown: boolean;
}>();

const { t } = useI18n();

const tools = computed(() => props.message.parts.filter((part): part is DynamicToolUIPart => part.type === 'dynamic-tool'));
const working = computed(() => props.streaming && props.message.parts.at(-1)?.type !== 'text');
const failed = computed(() => tools.value.some(part => part.state === 'output-error'));
const title = computed(() => {
    if (working.value) {
        return t('Working…');
    }
    return t('Worked · 1 step | Worked · {count} steps', { count: tools.value.length }, tools.value.length);
});

const listedTools = computed(() => tools.value.filter(part => part.input !== undefined));
const showAll = ref(false);
const hiddenCount = computed(() => showAll.value ? 0 : Math.max(0, listedTools.value.length - VISIBLE_STEPS));
const visibleTools = computed(() => listedTools.value.slice(hiddenCount.value));
function writesFile(part: DynamicToolUIPart): boolean {
    const input = part.input as Record<string, unknown> | undefined;
    return Boolean(input && ('old_string' in input || 'edits' in input || 'content' in input));
}

const commandTool = computed(() => {
    const latest = working.value ? listedTools.value.findLast(part => toolSummary(part.input) !== '') : undefined;
    return latest && props.fileChangesShown && writesFile(latest) ? undefined : latest;
});
</script>

<template>
    <ChatActivityBox
        v-if="tools.length > 0"
        :title="title"
        :active="working"
        :auto-open="streaming"
        :expandable="listedTools.length > 0"
        :icon="failed ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-wrench-screwdriver'"
        :icon-class="failed ? 'text-error' : ''"
        plain
    >
        <div v-if="listedTools.length > 0" class="flex flex-col gap-0.5">
            <UButton
                v-if="listedTools.length > VISIBLE_STEPS"
                :label="showAll ? t('Show fewer steps') : t('Show 1 earlier step | Show {count} earlier steps', { count: hiddenCount }, hiddenCount)"
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
