<script setup lang="ts">
import { isToolStreaming } from '@nuxt/ui/utils/ai';
import type { ChatMessage } from '#shared/types/conversation';
import type { ToolPart } from '~/utils/message-segments';

const props = defineProps<{
  parts: ToolPart[];
  message: ChatMessage;
  streaming: boolean;
}>();

const label = computed(() => props.parts.length === 1 ? 'Used 1 tool' : `Used ${props.parts.length} tools`);
const running = computed(() => props.streaming && props.parts.some(part => isToolStreaming(part)));
const failed = computed(() => props.parts.some(part => part.state === 'output-error'));
</script>

<template>
  <UCollapsible>
    <UButton
      :label="label"
      :icon="failed ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-wrench-screwdriver'"
      :loading="running"
      trailing-icon="i-heroicons-chevron-down"
      color="neutral"
      variant="soft"
      size="sm"
      class="group"
      :ui="{
        leadingIcon: failed ? 'text-error' : '',
        trailingIcon: 'transition-transform duration-200 group-data-[state=open]:rotate-180',
      }"
    />

    <template #content>
      <div class="flex flex-col gap-2 pt-2 ps-1">
        <ChatMessagePart
          v-for="(part, index) in parts"
          :key="part.toolCallId ?? index"
          :part="part"
          :message="message"
          :streaming="streaming"
        />
      </div>
    </template>
  </UCollapsible>
</template>
