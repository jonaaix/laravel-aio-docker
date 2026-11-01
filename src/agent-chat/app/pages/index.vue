<script setup lang="ts">
const input = ref('');
const sending = ref(false);
const { start } = useConversations();

async function submit(): Promise<void> {
  const text = input.value.trim();
  if (!text || sending.value) {
    return;
  }
  sending.value = true;
  try {
    const conversation = await start(text);
    input.value = '';
    await navigateTo(`/c/${conversation.id}`);
  }
  finally {
    sending.value = false;
  }
}
</script>

<template>
  <UDashboardPanel id="new-conversation">
    <template #header>
      <UDashboardNavbar title="New Conversation" />
    </template>

    <template #body>
      <UContainer class="flex flex-1 flex-col justify-center gap-6 py-8 sm:gap-8">
        <h1 class="text-center text-2xl font-bold tracking-tight text-highlighted lg:text-3xl">
          What should we work on?
        </h1>
        <UChatPrompt
          v-model="input"
          variant="outline"
          color="neutral"
          placeholder="Ask anything…"
          :disabled="sending"
          autofocus
          @submit="submit"
        >
          <UChatPromptSubmit :status="sending ? 'submitted' : 'ready'" color="neutral" />
        </UChatPrompt>
      </UContainer>
    </template>
  </UDashboardPanel>
</template>
