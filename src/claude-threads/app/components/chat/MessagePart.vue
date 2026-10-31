<script setup lang="ts">
import { isPartStreaming, isToolStreaming } from '@nuxt/ui/utils/ai';
import type { ChatMessage, ChatPart } from '#shared/types/conversation';

const props = defineProps<{
  part: ChatPart;
  message: ChatMessage;
  streaming: boolean;
}>();

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
  <UChatReasoning
    v-if="part.type === 'reasoning'"
    :text="part.text"
    :streaming="isPartStreaming(part) && streaming"
  >
    <Markdown :value="part.text" class="*:first:mt-0 *:last:mb-0" />
  </UChatReasoning>

  <UChatTool
    v-else-if="part.type === 'dynamic-tool'"
    :text="part.toolName"
    :suffix="toolSummary(part.input)"
    :streaming="isToolStreaming(part) && streaming"
    :icon="part.state === 'output-error' ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-wrench-screwdriver'"
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
