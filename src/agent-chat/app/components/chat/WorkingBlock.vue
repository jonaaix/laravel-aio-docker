<script setup lang="ts">
import { isToolStreaming } from '@nuxt/ui/utils/ai';
import type { ChatMessage } from '#shared/types/conversation';
import type { DynamicToolUIPart } from 'ai';

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

function lineIcon(part: DynamicToolUIPart): string {
  if (props.streaming && isToolStreaming(part)) {
    return 'i-heroicons-arrow-path';
  }
  return part.state === 'output-error' ? 'i-heroicons-x-circle' : 'i-heroicons-check';
}
</script>

<template>
  <ChatActivityBox
    v-if="tools.length > 0"
    :title="title"
    :active="working"
    :icon="failed ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-wrench-screwdriver'"
    :icon-class="failed ? 'text-error' : ''"
    show-all-label="Show all steps"
    show-less-label="Show fewer steps"
  >
    <template #default="{ expanded }">
      <div v-if="expanded" class="flex flex-col gap-1">
        <ChatMessagePart v-for="part in tools" :key="part.toolCallId" :part="part" :message="message" :streaming="streaming" />
      </div>
      <div v-else class="flex flex-col">
        <div v-for="part in tools" :key="part.toolCallId" class="flex min-w-0 items-start gap-2 text-sm leading-6">
          <UIcon
            :name="lineIcon(part)"
            class="mt-1 size-4 shrink-0"
            :class="[lineIcon(part) === 'i-heroicons-arrow-path' ? 'animate-spin text-muted' : '', part.state === 'output-error' ? 'text-error' : 'text-dimmed']"
          />
          <span class="shrink-0 text-default">{{ part.toolName }}</span>
          <span class="min-w-0 text-muted [overflow-wrap:anywhere]">{{ toolSummary(part.input) }}</span>
        </div>
      </div>
    </template>
  </ChatActivityBox>
</template>
