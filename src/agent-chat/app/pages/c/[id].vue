<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { Agent } from '#shared/types/agent';
import type { ChatMessage } from '#shared/types/conversation';
import type { AnswerLine } from '~/utils/answer-line';
import type { Participant } from '~/utils/avatars';

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
    turnActive,
    answeringAgentId,
    backgroundTasks,
    queuedMessages,
    agentIds,
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
    setAgent,
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

const { agents, lead } = useAgents();
const { conversations } = useConversations();
const leadAgent = computed<Participant>(() => ({ kind: 'agent', name: lead.value?.name ?? LEAD_AGENT_NAME, seed: lead.value ? lead.value.avatarSeed : LEAD_AGENT_AVATAR_SEED, image: lead.value?.avatarUrl }));

const { participant: userParticipant } = useUsers();
const mentionNames = useMentionNames();
const mentionKey = computed(() => mentionNames.value.join('|'));

function messageAuthor(message: ChatMessage): Participant {
    if (message.role === 'user') {
        return userParticipant(message.metadata?.senderId);
    }
    const author = agents.value.find(agent => agent.id === message.metadata?.agentId);
    return author && !author.lead ? agentParticipant(author) : leadAgent.value;
}

const memberAgentIds = computed(() => conversations.value.find(conversation => conversation.id === conversationId)?.agentIds ?? agentIds.value);
const memberAgents = computed(() => memberAgentIds.value.flatMap(id => agents.value.filter(agent => agent.id === id)));
const peerAgents = computed(() => agents.value.filter(agent => !agent.lead));

const agentOptions = computed(() => peerAgents.value.map(agent => ({ id: agent.id, name: agent.name, member: memberAgentIds.value.includes(agent.id), participant: agentParticipant(agent) })));

function agentParticipant(agent: Agent): Participant {
    return { kind: 'agent', name: agent.name, seed: agent.avatarSeed, image: agent.avatarUrl };
}

const typingAgent = computed<Participant | null>(() => {
    if (!answeringAgentId.value) {
        return null;
    }
    const agent = agents.value.find(candidate => candidate.id === answeringAgentId.value);
    return agent && !agent.lead ? agentParticipant(agent) : leadAgent.value;
});

const participants = computed<Participant[]>(() => {
    const senders = new Set(visibleMessages.value.flatMap(message => message.role === 'user' && message.metadata?.senderId ? [message.metadata.senderId] : []));
    return [
        leadAgent.value,
        ...memberAgents.value.map(agentParticipant),
        ...[...senders].map(userParticipant).filter(participant => participant.name),
    ];
});

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
    if (stickToBottom || (atBottom.value && !pinnedMessage)) {
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

const draftAnswer = computed(() => readAnswerBlock(input.value));
const chosenOptions = computed(() => draftAnswer.value.chosen);

const NOT_ANSWERED: AnswerLine = { accepted: false, chosen: {} };

const sentAnswers = computed(() => {
    const answers = new Map<string, AnswerLine>();
    let pending: string[] = [];
    for (const message of visibleMessages.value) {
        if (message.role === 'assistant') {
            pending.push(message.id);
            continue;
        }
        const reply = readAnswerBlock(messageText(message));
        pending.forEach(id => answers.set(id, reply.lineCount > 0 ? reply : NOT_ANSWERED));
        pending = [];
    }
    return answers;
});

function replaceAnswerBlock(block: string): void {
    const rest = input.value.split('\n').slice(draftAnswer.value.lineCount).join('\n').trimStart();
    input.value = rest && block ? `${block}\n\n${rest}` : block || rest;
    focusComposerAtEnd();
}

function choose(selection: Record<string, string>): void {
    replaceAnswerBlock(writeAnswerBlock(selection, draftAnswer.value.comments));
}

function accept(): void {
    replaceAnswerBlock('ok');
}

provide(questionAnswersKey, { messageId: answerableMessageId, chosen: chosenOptions, sent: messageId => sentAnswers.value.get(messageId), choose, accept });

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

const session = computed(() => sessionState(status.value, turnActive.value));
const conversationActions = computed<DropdownMenuItem[]>(() => [
    { label: 'Archive', icon: 'i-heroicons-archive-box', onSelect: archiveConversation },
]);
</script>

<template>
    <UDashboardPanel :id="`conversation-${conversationId}`" :ui="{ body: 'px-0 sm:px-0' }">
        <template #header>
            <div ref="header" class="sticky top-0 z-30 bg-default">
                <UDashboardNavbar :title="title">
                    <template #title>
                        <UTooltip :text="session.label">
                            <span class="size-2 shrink-0 rounded-full" :class="session.dotClass">
                                <span class="sr-only">{{ session.label }}</span>
                            </span>
                        </UTooltip>
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
                        <ChatParticipants v-if="loaded" :participants="participants" :agent-options="agentOptions" :editable="archivedAt === null" @toggle="setAgent" />
                        <template v-if="archivedAt === null && loaded">
                            <UButton
                                v-if="status === 'running'"
                                label="Pause session"
                                icon="i-heroicons-pause"
                                color="neutral"
                                variant="outline"
                                class="bg-white dark:bg-transparent"
                                :loading="pausing"
                                @click="pauseConversation"
                            />
                            <UDropdownMenu :items="conversationActions" :content="{ align: 'end' }">
                                <UTooltip text="More actions">
                                    <UButton
                                        icon="i-heroicons-ellipsis-horizontal"
                                        aria-label="More actions"
                                        color="neutral"
                                        variant="outline"
                                        class="bg-white dark:bg-transparent"
                                        :loading="archiving"
                                    />
                                </UTooltip>
                            </UDropdownMenu>
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
                    <USkeleton class="ms-auto h-10 w-2/5 rounded-md" />
                    <USkeleton class="h-24 w-4/5 rounded-md" />
                    <USkeleton class="ms-auto h-10 w-1/3 rounded-md" />
                    <USkeleton class="h-16 w-3/4 rounded-md" />
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
                        :ui="{ root: 'px-0 [&>article]:scroll-mt-(--message-scroll-margin) [&>article[data-role=assistant]+article[data-role=assistant]]:mt-6' }"
                        :should-scroll-to-bottom="false"
                        :assistant="{ side: 'left', variant: 'naked', ui: { container: 'flex-col gap-1.5 pb-7 sm:flex-row sm:gap-3', leading: 'mt-0 self-start xl:-ms-[6.75rem]', content: 'text-base/6.5', actions: 'h-6 gap-1' } }"
                        :user="{ side: 'right', variant: 'soft', ui: { container: 'max-w-[90%] flex-col items-end gap-1.5 pb-7 sm:max-w-[75%] sm:flex-row-reverse sm:items-start sm:justify-start sm:gap-3', leading: 'mt-0 self-end sm:self-start xl:-me-[6.75rem]', body: 'max-w-full', actions: 'h-6 gap-1', content: 'min-h-0 rounded-[1.125rem] bg-accented/50 px-3.5 py-2 text-base/6.5' } }"
                    >
                        <template #leading="{ message }">
                            <ChatHead :participant="messageAuthor(message)" :reverse="message.role === 'user'" />
                        </template>
                        <template #content="{ message }">
                            <div v-if="message.role === 'assistant'" class="mb-3 flex flex-col empty:hidden">
                                <ChatThinkingBlock :message="message" :streaming="isStreaming(message.id)" />
                                <ChatWorkingBlock :message="message" :streaming="isStreaming(message.id)" />
                            </div>
                            <template v-for="segment in answerSegments(message)" :key="`${segment.key}:${mentionKey}`">
                                <ChatImageGroup v-if="segment.kind === 'images'" :parts="segment.parts" />
                                <ChatMessagePart v-else :part="segment.part" :message="message" :streaming="isStreaming(message.id)" />
                            </template>
                            <ChatTurnOutcome v-if="message.role === 'assistant'" :message="message" />
                        </template>
                        <template #actions="{ message }">
                            <template v-if="!isStreaming(message.id)">
                                <ChatCopyButton v-if="messageText(message)" :text="messageText(message)" />
                                <span class="px-1 text-xs text-muted tabular-nums">{{ formatClockTime(message.metadata!.createdAt) }}</span>
                            </template>
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
                    <div class="flex h-6 items-center px-3.5">
                        <Transition enter-active-class="transition-opacity duration-150 ease-out" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150 ease-in" leave-to-class="opacity-0">
                            <div v-if="typingAgent" class="flex min-w-0 items-center gap-1.5 text-xs text-muted">
                                <ParticipantAvatar :participant="typingAgent" class="size-4 shrink-0" />
                                <span class="truncate"><span class="font-medium text-toned">{{ typingAgent.name }}</span> is typing…</span>
                            </div>
                        </Transition>
                    </div>
                    <ChatComposer
                        v-model="input"
                        placeholder="Send a message…"
                        :status="chatStatus"
                        :error="error"
                        :attachments="attachments"
                        :uploading="uploading"
                        :mentions="participants"
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
