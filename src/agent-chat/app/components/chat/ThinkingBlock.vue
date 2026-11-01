<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';
import type { ReasoningUIPart } from 'ai';

const props = defineProps<{
  message: ChatMessage;
  streaming: boolean;
}>();

const reasoning = computed(() => props.message.parts.filter((part): part is ReasoningUIPart => part.type === 'reasoning'));
const text = computed(() => reasoning.value.map(part => part.text.trim()).filter(Boolean).join('\n\n'));
const thinking = computed(() => {
  const last = props.message.parts.at(-1);
  return props.streaming && last?.type === 'reasoning' && last.state === 'streaming';
});
</script>

<template>
  <UChatReasoning v-if="text" :text="text" :streaming="thinking" class="mb-2">
    <Markdown :value="text" class="*:first:mt-0 *:last:mb-0" />
  </UChatReasoning>
  <UChatShimmer v-else-if="thinking" text="Thinking…" class="mb-2 block text-sm" />
</template>
