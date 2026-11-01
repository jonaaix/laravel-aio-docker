<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';
import type { DynamicToolUIPart } from 'ai';

const props = defineProps<{
  message: ChatMessage;
  streaming: boolean;
}>();

const tools = computed(() => props.message.parts.filter((part): part is DynamicToolUIPart => part.type === 'dynamic-tool'));
const working = computed(() => props.streaming && props.message.parts.at(-1)?.type === 'dynamic-tool');
const failed = computed(() => tools.value.some(part => part.state === 'output-error'));

const currentStep = computed(() => {
  const last = tools.value.at(-1);
  return working.value && last ? `${last.toolName} ${toolSummary(last.input)}`.trim() : '';
});

const summary = computed(() => tools.value.length === 1 ? 'Worked · 1 step' : `Worked · ${tools.value.length} steps`);
</script>

<template>
  <UCollapsible v-if="tools.length > 0" class="mb-2">
    <UButton
      color="neutral"
      variant="soft"
      size="sm"
      trailing-icon="i-heroicons-chevron-down"
      class="group max-w-full"
      :ui="{ trailingIcon: 'transition-transform duration-200 group-data-[state=open]:rotate-180' }"
    >
      <UIcon v-if="working" name="i-heroicons-arrow-path" class="size-4 shrink-0 animate-spin" />
      <UIcon v-else-if="failed" name="i-heroicons-exclamation-triangle" class="size-4 shrink-0 text-error" />
      <UIcon v-else name="i-heroicons-wrench-screwdriver" class="size-4 shrink-0" />
      <template v-if="working">
        <UChatShimmer text="Working…" class="shrink-0" />
        <span class="truncate text-muted">{{ currentStep }}</span>
      </template>
      <span v-else>{{ summary }}</span>
    </UButton>

    <template #content>
      <div class="flex flex-col gap-2 pt-2 ps-1">
        <ChatMessagePart
          v-for="part in tools"
          :key="part.toolCallId"
          :part="part"
          :message="message"
          :streaming="streaming"
        />
      </div>
    </template>
  </UCollapsible>
</template>
