<script setup lang="ts">
const route = useRoute();
const conversationId = route.params.id as string;
const { title, messages, status, error, chatStatus, load, subscribe, send, stop, pause } = useConversation(conversationId);

const input = ref('');
const pausing = ref(false);

let unsubscribe: (() => void) | undefined;

onMounted(async () => {
  unsubscribe = subscribe();
  await load();
});

onBeforeUnmount(() => unsubscribe?.());

async function submit(): Promise<void> {
  const text = input.value.trim();
  if (!text) {
    return;
  }
  input.value = '';
  await send(text);
}

async function pauseConversation(): Promise<void> {
  pausing.value = true;
  try {
    await pause();
  }
  finally {
    pausing.value = false;
  }
}
</script>

<template>
  <UDashboardPanel :id="`conversation-${conversationId}`">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #right>
          <UBadge v-if="status === 'paused'" label="Paused" color="neutral" variant="subtle" />
          <UButton
            v-else
            label="Pause"
            icon="i-heroicons-pause"
            color="neutral"
            variant="ghost"
            :loading="pausing"
            @click="pauseConversation"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UContainer class="flex-1">
        <UChatMessages
          :messages="messages"
          :status="chatStatus"
          should-auto-scroll
          :assistant="{ side: 'left', variant: 'naked' }"
          :user="{ side: 'right', variant: 'soft' }"
        >
          <template #content="{ message }">
            <ChatMessagePart
              v-for="(part, index) in message.parts"
              :key="`${message.id}-${index}`"
              :part="part"
              :message="message"
              :streaming="chatStatus === 'streaming' && message.id === messages.at(-1)?.id"
            />
          </template>
        </UChatMessages>
      </UContainer>
    </template>

    <template #footer>
      <UContainer class="pb-4 sm:pb-6">
        <UChatPrompt
          v-model="input"
          variant="subtle"
          placeholder="Send a message…"
          :error="error"
          @submit="submit"
        >
          <UChatPromptSubmit :status="chatStatus" color="neutral" @stop="stop" />
        </UChatPrompt>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
