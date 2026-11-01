<script setup lang="ts">
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

const toggled = ref<Record<string, boolean>>({});

function isOpen(part: DynamicToolUIPart, index: number): boolean {
  return toggled.value[part.toolCallId] ?? (working.value && index === tools.value.length - 1);
}

function setOpen(part: DynamicToolUIPart, open: boolean): void {
  toggled.value = { ...toggled.value, [part.toolCallId]: open };
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
    <div class="flex flex-col gap-1">
      <ChatMessagePart
        v-for="(part, index) in tools"
        :key="part.toolCallId"
        :part="part"
        :message="message"
        :streaming="streaming"
        :open="isOpen(part, index)"
        @update:open="setOpen(part, $event)"
      />
    </div>
  </ChatActivityBox>
</template>
