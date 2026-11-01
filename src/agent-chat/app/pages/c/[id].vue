<script setup lang="ts">
const EARLIER_THRESHOLD_PX = 200;
const AT_BOTTOM_THRESHOLD_PX = 120;
const ANSWER_GAP_PX = 32;
const STICK_TO_BOTTOM_MS = 3000;
const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'keydown'] as const;

const route = useRoute();
const conversationId = route.params.id as string;
const {
    title,
    workingDir,
    messages,
    status,
    backgroundTasks,
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

provide(workingDirKey, workingDir);

const input = ref('');
const pausing = ref(false);
const archiving = ref(false);
const timeline = ref<HTMLElement | null>(null);

const backgroundLabel = computed(() => backgroundTasks.value.length === 1
    ? `Running in background: ${backgroundTasks.value[0]}`
    : `${backgroundTasks.value.length} background tasks running`);

const visibleMessages = computed(() => messages.value.filter(message => message.parts.length > 0
    || message.metadata?.outcome === 'stopped'
    || message.metadata?.outcome === 'failed'));

function isStreaming(messageId: string): boolean {
    return chatStatus.value === 'streaming' && messageId === visibleMessages.value.at(-1)?.id;
}

let unsubscribe: (() => void) | undefined;
let contentObserver: ResizeObserver | undefined;

const header = ref<HTMLElement | null>(null);
const composerBar = ref<HTMLElement | null>(null);
const atBottom = ref(true);
const answerSpace = ref(0);
let sentThisVisit = false;
let stickToBottom = false;

function scroller(): HTMLElement {
    return document.scrollingElement as HTMLElement;
}

async function loadEarlierKeepingPosition(): Promise<void> {
    if (!hasEarlier.value || loadingEarlier.value) {
        return;
    }
    const distanceFromBottom = scroller().scrollHeight - scroller().scrollTop;
    await loadEarlier();
    await nextTick();
    scroller().scrollTop = scroller().scrollHeight - distanceFromBottom;
}

function updateAtBottom(): void {
    const element = scroller();
    atBottom.value = element.scrollHeight - element.scrollTop - element.clientHeight < AT_BOTTOM_THRESHOLD_PX;
}

function updateAnswerSpace(): void {
    const lastUserMessage = [...(timeline.value?.parentElement?.querySelectorAll<HTMLElement>('[data-role="user"]') ?? [])].at(-1);
    if (!sentThisVisit || !lastUserMessage) {
        answerSpace.value = 0;
        return;
    }
    const reserved = headerHeight() + (composerBar.value?.offsetHeight ?? 0) + lastUserMessage.offsetHeight + ANSWER_GAP_PX;
    answerSpace.value = Math.max(0, window.innerHeight - reserved);
}

function onScroll(): void {
    updateAtBottom();
    if (scroller().scrollTop < EARLIER_THRESHOLD_PX) {
        loadEarlierKeepingPosition();
    }
}

function onResize(): void {
    updateAnswerSpace();
    updateAtBottom();
}

function jumpToBottom(): void {
    window.scrollTo({ top: scroller().scrollHeight, behavior: 'smooth' });
}

function releaseBottom(): void {
    stickToBottom = false;
}

function onContentResize(): void {
    if (stickToBottom) {
        scroller().scrollTop = scroller().scrollHeight;
    }
    updateAtBottom();
}

function headerHeight(): number {
    return header.value?.offsetHeight ?? 0;
}

async function alignLatestUserMessage(): Promise<void> {
    await nextTick();
    updateAnswerSpace();
    await nextTick();
    const lastUserMessage = [...(timeline.value?.parentElement?.querySelectorAll<HTMLElement>('[data-role="user"]') ?? [])].at(-1);
    if (lastUserMessage) {
        const top = lastUserMessage.getBoundingClientRect().top + scroller().scrollTop - headerHeight() - ANSWER_GAP_PX / 2;
        window.scrollTo({ top, behavior: 'smooth' });
    }
}

watch(() => visibleMessages.value.at(-1), (message, previous) => {
    if (sentThisVisit && message?.role === 'user' && message.id !== previous?.id) {
        alignLatestUserMessage();
    }
});

onMounted(async () => {
    unsubscribe = subscribe();
    await load();
    await nextTick();
    stickToBottom = true;
    scroller().scrollTop = scroller().scrollHeight;
    setTimeout(releaseBottom, STICK_TO_BOTTOM_MS);
    USER_SCROLL_EVENTS.forEach(name => window.addEventListener(name, releaseBottom, { passive: true }));
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    contentObserver = new ResizeObserver(onContentResize);
    contentObserver.observe(document.body);
    onScroll();
});

onBeforeUnmount(() => {
    unsubscribe?.();
    USER_SCROLL_EVENTS.forEach(name => window.removeEventListener(name, releaseBottom));
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    contentObserver?.disconnect();
});

async function submit(): Promise<void> {
    const text = input.value.trim();
    if (!text) {
        return;
    }
    input.value = '';
    sentThisVisit = true;
    releaseBottom();
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
const archiveConversation = () => withFlag(archiving, async () => {
    await archive();
    await navigateTo('/');
});
const restoreConversation = () => withFlag(archiving, restore);
</script>

<template>
    <UDashboardPanel :id="`conversation-${conversationId}`">
        <template #header>
            <div ref="header" class="sticky top-0 z-30 bg-default">
                <UDashboardNavbar :title="title">
                    <template #right>
                        <template v-if="archivedAt !== null">
                            <UBadge label="Archived" color="neutral" variant="subtle" />
                            <UButton
                                label="Restore"
                                icon="i-heroicons-arrow-uturn-left"
                                color="neutral"
                                variant="outline"
                                class="bg-white dark:bg-transparent"
                                :loading="archiving"
                                @click="restoreConversation"
                            />
                        </template>
                        <UButton
                            v-else-if="loaded"
                            label="Archive"
                            icon="i-heroicons-archive-box"
                            color="neutral"
                            variant="outline"
                            class="bg-white dark:bg-transparent"
                            :loading="archiving"
                            @click="archiveConversation"
                        />
                    </template>
                </UDashboardNavbar>
                <UDashboardToolbar v-if="loaded && archivedAt === null" class="border-b-0 pb-2">
                    <template #left>
                        <UBadge v-if="status === 'paused'" label="Session paused" color="neutral" variant="subtle" size="lg" />
                        <UButton
                            v-else
                            label="Pause session"
                            icon="i-heroicons-pause"
                            color="neutral"
                            variant="outline"
                            class="bg-white dark:bg-transparent"
                            :loading="pausing"
                            @click="pauseConversation"
                        />
                        <UTooltip v-if="backgroundTasks.length > 0" :text="backgroundTasks.join(' · ')">
                            <span class="flex min-w-0 items-center gap-1.5 ps-2 text-sm text-muted">
                                <UIcon name="i-heroicons-arrow-path" class="size-4 shrink-0 animate-spin" />
                                <span class="truncate">{{ backgroundLabel }}</span>
                            </span>
                        </UTooltip>
                    </template>
                </UDashboardToolbar>
            </div>
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
                        :auto-scroll="false"
                        :style="{ '--last-message-height': `${answerSpace}px` }"
                        :ui="{ root: '[&>article]:scroll-mt-20' }"
                        :should-scroll-to-bottom="false"
                        :assistant="{ side: 'left', variant: 'naked' }"
                        :user="{ side: 'right', variant: 'soft', ui: { content: 'rounded-[1.25rem]' } }"
                    >
                        <template #content="{ message }">
                            <div v-if="message.role === 'assistant'" class="mb-6 flex flex-col gap-3 empty:hidden">
                                <ChatThinkingBlock :message="message" :streaming="isStreaming(message.id)" />
                                <ChatWorkingBlock :message="message" :streaming="isStreaming(message.id)" />
                            </div>
                            <template v-for="segment in answerSegments(message)" :key="segment.key">
                                <ChatImageGroup v-if="segment.kind === 'images'" :parts="segment.parts" />
                                <ChatMessagePart v-else :part="segment.part" :message="message" :streaming="isStreaming(message.id)" />
                            </template>
                            <ChatTurnOutcome v-if="message.role === 'assistant'" :message="message" />
                        </template>
                    </UChatMessages>
                </template>
            </UContainer>
        </template>

        <template v-if="loaded && archivedAt === null" #footer>
            <div ref="composerBar" class="sticky bottom-0 z-20 bg-default">
                <Transition
                    enter-active-class="transition-opacity duration-[180ms] ease-out"
                    leave-active-class="transition-opacity duration-[160ms] ease-in"
                    enter-from-class="opacity-0"
                    leave-to-class="opacity-0"
                >
                    <div v-if="!atBottom" class="pointer-events-none absolute inset-x-0 -top-14 flex justify-center">
                        <UTooltip text="Jump to latest">
                            <UButton
                                icon="i-heroicons-arrow-down"
                                aria-label="Jump to latest"
                                color="neutral"
                                variant="outline"
                                class="pointer-events-auto bg-default shadow-lg"
                                @click="jumpToBottom"
                            />
                        </UTooltip>
                    </div>
                </Transition>
                <UContainer class="pb-4 sm:pb-6">
                    <ChatComposer
                        v-model="input"
                        placeholder="Send a message…"
                        :status="chatStatus"
                        :error="error"
                        @submit="submit"
                        @stop="stop"
                    />
                </UContainer>
            </div>
        </template>
    </UDashboardPanel>
</template>
