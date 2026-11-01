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
    :items="tools"
    :item-key="part => part.toolCallId"
    :earlier-label="count => count === 1 ? 'Show 1 earlier step' : `Show ${count} earlier steps`"
    fewer-label="Show fewer steps"
  >
    <template #item="{ item, index }">
      <ChatMessagePart
        :part="item"
        :message="message"
        :streaming="streaming"
        :open="isOpen(item, index)"
        @update:open="setOpen(item, $event)"
      />
    </template>
  </ChatActivityBox>
</template>
