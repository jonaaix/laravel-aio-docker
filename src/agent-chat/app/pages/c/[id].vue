<script setup lang="ts">
const EARLIER_THRESHOLD_PX = 200;
const AT_BOTTOM_THRESHOLD_PX = 120;
const ANSWER_GAP_PX = 32;
const STICK_TO_BOTTOM_MS = 3000;
const PIN_SENT_MESSAGE_MS = 2000;
const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'keydown'] as const;

const route = useRoute();
const conversationId = route.params.id as string;
const {
    title,
    workingDir,
    messages,
    status,
    backgroundTasks,
    queuedMessages,
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
    rename,
} = useConversation(conversationId);

provide(workingDirKey, workingDir);

const input = ref('');
const { attachments, uploading, ready, add: attach, remove: removeAttachment, take: takeAttachments } = useAttachments();
const pausing = ref(false);
const archiving = ref(false);
const timeline = ref<HTMLElement | null>(null);

const visibleMessages = computed(() => messages.value.filter(message => message.parts.length > 0
    || message.metadata?.outcome === 'stopped'
    || message.metadata?.outcome === 'failed'));

const answerableMessageId = computed(() => {
    const last = visibleMessages.value.at(-1);
    return last?.role === 'assistant' && chatStatus.value === 'ready' && archivedAt.value === null ? last.id : null;
});

function isStreaming(messageId: string): boolean {
    return chatStatus.value === 'streaming' && messageId === visibleMessages.value.at(-1)?.id;
}

let unsubscribe: (() => void) | undefined;
let contentObserver: ResizeObserver | undefined;

const header = ref<HTMLElement | null>(null);
const composerBar = ref<HTMLElement | null>(null);
const atBottom = ref(true);
const answerSpace = ref(0);
const messageScrollMargin = ref(0);
let sentThisVisit = false;
let stickToBottom = false;
let pinnedMessage: HTMLElement | null = null;
let unpinTimer: ReturnType<typeof setTimeout> | undefined;

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
    messageScrollMargin.value = headerHeight() + ANSWER_GAP_PX / 2;
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
    pinnedMessage = null;
}

function keepPinnedMessageInPlace(): void {
    if (!pinnedMessage) {
        return;
    }
    const offset = pinnedMessage.getBoundingClientRect().top - messageScrollMargin.value;
    if (Math.abs(offset) > 1) {
        window.scrollTo({ top: scroller().scrollTop + offset });
    }
}

function onContentResize(): void {
    if (stickToBottom) {
        scroller().scrollTop = scroller().scrollHeight;
    }
    keepPinnedMessageInPlace();
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
        const top = lastUserMessage.getBoundingClientRect().top + scroller().scrollTop - messageScrollMargin.value;
        window.scrollTo({ top, behavior: 'smooth' });
        pinnedMessage = lastUserMessage;
        clearTimeout(unpinTimer);
        unpinTimer = setTimeout(() => {
            pinnedMessage = null;
        }, PIN_SENT_MESSAGE_MS);
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
    updateAnswerSpace();
    stickToBottom = true;
    scroller().scrollTop = scroller().scrollHeight;
    setTimeout(releaseBottom, STICK_TO_BOTTOM_MS);
    USER_SCROLL_EVENTS.forEach(name => window.addEventListener(name, releaseBottom, { passive: true }));
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', keepPinnedMessageInPlace, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    contentObserver = new ResizeObserver(onContentResize);
    contentObserver.observe(document.body);
    onScroll();
});

onBeforeUnmount(() => {
    unsubscribe?.();
    USER_SCROLL_EVENTS.forEach(name => window.removeEventListener(name, releaseBottom));
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('scrollend', keepPinnedMessageInPlace);
    clearTimeout(unpinTimer);
    window.removeEventListener('resize', onResize);
    contentObserver?.disconnect();
});

async function submit(): Promise<void> {
    const text = input.value.trim();
    if ((!text && ready.value.length === 0) || uploading.value) {
        return;
    }
    input.value = '';
    answerLine = '';
    sentThisVisit = true;
    releaseBottom();
    await send(text, takeAttachments());
}

async function focusComposerAtEnd(): Promise<void> {
    await nextTick();
    const textarea = composerBar.value?.querySelector('textarea');
    if (!textarea) {
        return;
    }
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    textarea.scrollTop = textarea.scrollHeight;
}

function quote(text: string): void {
    const quoted = text.split('\n').map(line => line.trim() ? `> ${line}` : '>').join('\n');
    const existing = input.value.replace(/\s+$/, '');
    input.value = `${existing ? `${existing}\n\n` : ''}${quoted}\n\n`;
    focusComposerAtEnd();
}

let answerLine = '';

function answer(line: string): void {
    const previous = answerLine && input.value.startsWith(answerLine) ? input.value.slice(answerLine.length) : input.value;
    const rest = previous.trimStart();
    answerLine = line;
    input.value = rest && line ? `${line}\n\n${rest}` : line || rest;
    focusComposerAtEnd();
}

provide(questionAnswersKey, { messageId: answerableMessageId, answer });

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
                <UDashboardNavbar :title="title" :ui="{ title: '-ms-2' }">
                    <template #title>
                        <ChatTitleEditor :title="title" :editable="loaded && archivedAt === null" :save="rename" />
                    </template>
                    <template #right>
                        <template v-if="archivedAt !== null">
                            <UBadge label="Archived" color="neutral" variant="subtle" size="lg" class="h-9 px-3" />
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
                        <template v-else-if="loaded">
                            <UBadge v-if="status === 'paused'" label="Session paused" color="neutral" variant="subtle" size="lg" class="h-9 px-3" />
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
                            <UButton
                                label="Archive"
                                icon="i-heroicons-archive-box"
                                color="neutral"
                                variant="outline"
                                class="bg-white dark:bg-transparent"
                                :loading="archiving"
                                @click="archiveConversation"
                            />
                        </template>
                    </template>
                </UDashboardNavbar>
            </div>
        </template>

        <template #body>
            <UContainer class="flex-1">
                <div ref="timeline" />
                <ChatQuoteButton v-if="loaded && archivedAt === null" :root="timeline?.parentElement ?? null" @quote="quote" />
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
                        :style="{ '--last-message-height': `${answerSpace}px`, '--message-scroll-margin': `${messageScrollMargin}px` }"
                        :ui="{ root: '[&>article]:scroll-mt-(--message-scroll-margin)' }"
                        :should-scroll-to-bottom="false"
                        :assistant="{ side: 'left', variant: 'naked' }"
                        :user="{ side: 'right', variant: 'soft', ui: { content: 'rounded-[1.25rem]' } }"
                    >
                        <template #content="{ message }">
                            <div v-if="message.role === 'assistant'" class="mb-4 flex flex-col gap-2 empty:hidden">
                                <ChatThinkingBlock :message="message" :streaming="isStreaming(message.id)" />
                                <ChatWorkingBlock :message="message" :streaming="isStreaming(message.id)" />
                            </div>
                            <template v-for="segment in answerSegments(message)" :key="segment.key">
                                <ChatImageGroup v-if="segment.kind === 'images'" :parts="segment.parts" />
                                <ChatMessagePart v-else :part="segment.part" :message="message" :streaming="isStreaming(message.id)" />
                            </template>
                            <ChatTurnOutcome v-if="message.role === 'assistant'" :message="message" />
                        </template>
                        <template #actions="{ message }">
                            <ChatCopyButton v-if="!isStreaming(message.id) && messageText(message)" :text="messageText(message)" />
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
                    <ChatBackgroundTasks v-if="backgroundTasks.length > 0" :tasks="backgroundTasks" class="mb-2" />
                    <ChatQueuedMessages v-if="queuedMessages.length > 0" :messages="queuedMessages" class="mb-2" />
                    <ChatComposer
                        v-model="input"
                        placeholder="Send a message…"
                        :status="chatStatus"
                        :error="error"
                        :attachments="attachments"
                        :uploading="uploading"
                        @submit="submit"
                        @stop="stop"
                        @attach="attach"
                        @remove="removeAttachment"
                    />
                    <ChatDropZone @drop="attach" />
                </UContainer>
            </div>
        </template>
    </UDashboardPanel>
</template>
