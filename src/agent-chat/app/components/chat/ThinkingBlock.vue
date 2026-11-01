<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';
import type { ReasoningUIPart } from 'ai';

const props = defineProps<{
  message: ChatMessage;
  streaming: boolean;
}>();

const reasoning = computed(() => props.message.parts.filter((part): part is ReasoningUIPart => part.type === 'reasoning'));
const thoughts = computed(() => reasoning.value.map(part => part.text.trim().replace(/\n{2,}/g, '\n')).filter(Boolean));
const thinking = computed(() => {
  const last = props.message.parts.at(-1);
  return props.streaming && last?.type === 'reasoning' && last.state === 'streaming';
});

const thoughtThisTurn = ref(false);
watch(thinking, value => {
  if (value) {
    thoughtThisTurn.value = true;
  }
}, { immediate: true });

const visible = computed(() => thoughts.value.length > 0 || (props.streaming && thoughtThisTurn.value));
</script>

<template>
  <ChatActivityBox
    v-if="visible"
    :title="thinking ? 'Thinking…' : 'Thought'"
    :active="thinking"
    icon="i-heroicons-light-bulb"
    :items="thoughts"
    :item-key="(_, index) => `thought-${index}`"
    :earlier-label="count => count === 1 ? 'Show 1 earlier thought' : `Show ${count} earlier thoughts`"
    fewer-label="Show fewer thoughts"
  >
    <template #item="{ item }">
      <div class="flex gap-2 text-sm leading-6 text-muted">
        <span class="mt-2.5 size-1 shrink-0 rounded-full bg-current" />
        <span class="min-w-0 whitespace-pre-line">{{ item }}</span>
      </div>
    </template>
  </ChatActivityBox>
</template>
