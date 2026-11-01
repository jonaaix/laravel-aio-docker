<script setup lang="ts">
const EARLIER_THRESHOLD_PX = 200;

const route = useRoute();
const conversationId = route.params.id as string;
const {
  title,
  messages,
  status,
  archivedAt,
  loaded,
  hasEarlier,
  loadingEarlier,
  error,
  chatStatus,
  load,
  loadEarlier,
  subscribe,
  send,
  stop,
  pause,
  archive,
  restore,
} = useConversation(conversationId);

const input = ref('');
const pausing = ref(false);
const archiving = ref(false);
const timeline = ref<HTMLElement | null>(null);

const visibleMessages = computed(() => messages.value.filter(message => message.parts.length > 0));

function isStreaming(messageId: string): boolean {
  return chatStatus.value === 'streaming' && messageId === visibleMessages.value.at(-1)?.id;
}

let unsubscribe: (() => void) | undefined;
let scrollParent: HTMLElement | null = null;

function findScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current && !/auto|scroll/.test(getComputedStyle(current).overflowY)) {
    current = current.parentElement;
  }
  return current;
}

async function loadEarlierKeepingPosition(): Promise<void> {
  const parent = scrollParent;
  if (!parent || !hasEarlier.value || loadingEarlier.value) {
    return;
  }
  const distanceFromBottom = parent.scrollHeight - parent.scrollTop;
  await loadEarlier();
  await nextTick();
  parent.scrollTop = parent.scrollHeight - distanceFromBottom;
}

function onScroll(): void {
  if (scrollParent && scrollParent.scrollTop < EARLIER_THRESHOLD_PX) {
    loadEarlierKeepingPosition();
  }
}

onMounted(async () => {
  unsubscribe = subscribe();
  await load();
  await nextTick();
  scrollParent = findScrollParent(timeline.value);
  scrollParent?.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
});

onBeforeUnmount(() => {
  unsubscribe?.();
  scrollParent?.removeEventListener('scroll', onScroll);
});

async function submit(): Promise<void> {
  const text = input.value.trim();
  if (!text) {
    return;
  }
  input.value = '';
  await send(text);
}

async function withFlag(flag: Ref<boolean>, action: () => Promise<void>): Promise<void> {
  flag.value = true;
  try {
    await action();
  }
  finally {
    flag.value = false;
  }
}

const pauseConversation = () => withFlag(pausing, pause);
const archiveConversation = () => withFlag(archiving, archive);
const restoreConversation = () => withFlag(archiving, restore);
</script>

<template>
  <UDashboardPanel :id="`conversation-${conversationId}`">
    <template #header>
      <UDashboardNavbar :title="title">
        <template #right>
          <template v-if="archivedAt !== null">
            <UBadge label="Archived" color="neutral" variant="subtle" />
            <UButton
              label="Restore"
              icon="i-heroicons-arrow-uturn-left"
              color="neutral"
              variant="ghost"
              :loading="archiving"
              @click="restoreConversation"
            />
          </template>
          <template v-else-if="loaded">
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
            <UTooltip text="Archive">
              <UButton
                icon="i-heroicons-archive-box"
                aria-label="Archive"
                color="neutral"
                variant="ghost"
                :loading="archiving"
                @click="archiveConversation"
              />
            </UTooltip>
          </template>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UContainer class="flex-1">
        <div ref="timeline" />
        <div v-if="!loaded" class="flex flex-col gap-6 py-4">
          <USkeleton class="ms-auto h-10 w-2/5 rounded-xl" />
          <USkeleton class="h-24 w-4/5 rounded-xl" />
          <USkeleton class="ms-auto h-10 w-1/3 rounded-xl" />
          <USkeleton class="h-16 w-3/4 rounded-xl" />
        </div>

        <template v-else>
          <div v-if="loadingEarlier" class="flex justify-center py-3">
            <UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin text-muted" />
          </div>

          <UChatMessages
            :messages="visibleMessages"
            :status="chatStatus"
            should-auto-scroll
            should-scroll-to-bottom
            :assistant="{ side: 'left', variant: 'naked' }"
            :user="{ side: 'right', variant: 'soft', ui: { content: 'rounded-[1.25rem]' } }"
          >
            <template #content="{ message }">
              <template v-for="segment in messageSegments(message.id, message.parts)" :key="segment.key">
                <ChatToolGroup
                  v-if="segment.kind === 'tools'"
                  :parts="segment.parts"
                  :message="message"
                  :streaming="isStreaming(message.id)"
                />
                <ChatMessagePart
                  v-else
                  :part="segment.part"
                  :message="message"
                  :streaming="isStreaming(message.id)"
                />
              </template>
            </template>
          </UChatMessages>
        </template>
      </UContainer>
    </template>

    <template v-if="loaded && archivedAt === null" #footer>
      <UContainer class="pb-4 sm:pb-6">
        <UChatPrompt
          v-model="input"
          variant="outline"
          color="neutral"
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
