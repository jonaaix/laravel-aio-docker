<script setup lang="ts">
import type { Agent } from '#shared/types/agent';
import type { ChatMessage, ConversationSummary } from '#shared/types/conversation';
import type { AnswerLine } from '~/utils/answer-line';
import type { Participant } from '~/utils/avatars';
import { CHANGES_PANEL_MIN_PX } from '~/composables/useChangesPanelRoom';

const EARLIER_THRESHOLD_PX = 200;
const AT_BOTTOM_THRESHOLD_PX = 120;
const ANSWER_GAP_PX = 32;
const STICK_TO_BOTTOM_MS = 3000;
const SETTLE_QUIET_MS = 100;
const SKELETON_DELAY_MS = 300;
const SETTLE_MAX_MS = 900;
const PIN_SENT_MESSAGE_MS = 2000;
const USER_SCROLL_EVENTS = ['wheel', 'touchmove', 'keydown'] as const;
// Off for now: the streaming answer already shows that an agent is working; kept for multi-agent use.
const SHOW_TYPING_LINE = false;

const { t } = useI18n();
const route = useRoute();
const conversationId = route.params.id as string;
const readAlong = useReadAlong();
readAlong.follow();
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
useDraft(conversationId, input);
const { attachments, uploading, ready, add: attach, remove: removeAttachment, take: takeAttachments } = useAttachments();
const pausing = ref(false);
const archiving = ref(false);
const timeline = ref<HTMLElement | null>(null);

const visibleMessages = computed(() => messages.value.filter(message => message.parts.length > 0
    || message.metadata?.outcome === 'stopped'
    || message.metadata?.outcome === 'failed'));

const { agents, lead } = useAgents();
const { conversations, upsert: upsertConversation } = useConversations();
const { public: { hub } } = useRuntimeConfig();
const { userId } = useUserName();
const muting = ref(false);
const muted = computed(() => !!userId.value && !!conversations.value.find(conversation => conversation.id === conversationId)?.mutedUserIds.includes(userId.value));

async function toggleMute(): Promise<void> {
    muting.value = true;
    try {
        upsertConversation(await apiFetch<ConversationSummary>(`conversations/${conversationId}/mute`, { method: 'POST', body: { muted: !muted.value } }));
    }
    finally {
        muting.value = false;
    }
}
const leadAgent = computed<Participant>(() => ({ kind: 'agent', name: lead.value?.name ?? LEAD_AGENT_NAME, seed: lead.value ? lead.value.avatarSeed : LEAD_AGENT_AVATAR_SEED, image: lead.value?.avatarUrl }));

const { participant: userParticipant } = useUsers();
const { pinSentMessage, changesPanelHidden, changesPanelAuto, setChangesPanelHidden } = useAppearance();
const { profile: account, loaded: accountLoaded } = useAccount();
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

function agentName(agentId: string): string {
    return agents.value.find(agent => agent.id === agentId)?.name ?? leadAgent.value.name;
}

const startingSession = ref(false);

watch([turnActive, status], ([active], [wasActive, wasStatus]) => {
    if (active && !wasActive) {
        startingSession.value = wasStatus === 'paused';
    }
});

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

const followUpIds = computed(() => new Set(visibleMessages.value.flatMap((message, index) => {
    const previous = visibleMessages.value[index - 1];
    const sameAuthor = previous?.role === message.role && (message.role === 'user'
        ? previous.metadata?.senderId === message.metadata?.senderId
        : previous.metadata?.agentId === message.metadata?.agentId);
    return sameAuthor ? [message.id] : [];
})));

function isStreaming(messageId: string): boolean {
    return chatStatus.value === 'streaming' && messageId === visibleMessages.value.at(-1)?.id;
}

const header = ref<HTMLElement | null>(null);
const changesPanelRoom = useChangesPanelRoom(header);
const changesPanelAvailable = computed(() => !isEmbedded() && changesPanelRoom.value >= CHANGES_PANEL_MIN_PX);
const changesOverlayOpen = ref(false);
const changesTitle = useChangesTitle();
const selectedChangesId = ref<string | null>(null);
const changedMessages = computed(() => visibleMessages.value.filter(message => message.role === 'assistant' && turnFileChanges(message).files.length > 0));
const changesMessage = computed(() => changedMessages.value.find(message => message.id === selectedChangesId.value) ?? changedMessages.value.at(-1) ?? null);
const changesOpenedHere = ref(false);
const changesPanelShown = computed(() => changesPanelAvailable.value && changesMessage.value !== null
    && (changesPanelAuto.value ? !changesPanelHidden.value : changesOpenedHere.value));

watch(() => changedMessages.value.at(-1)?.id, () => {
    selectedChangesId.value = null;
});
watch(changesPanelAvailable, (available) => {
    if (available && changesOverlayOpen.value) {
        changesOverlayOpen.value = false;
        openChangesPanel();
    }
});

const stopArmed = useEscapeToStop(() => chatStatus.value === 'streaming' || chatStatus.value === 'submitted', () => void stop());

function changesShownFor(messageId: string): boolean {
    return (changesPanelShown.value || changesOverlayOpen.value) && changesMessage.value?.id === messageId;
}

function openChangesPanel(): void {
    changesOpenedHere.value = true;
    if (changesPanelAuto.value && changesPanelHidden.value) {
        void setChangesPanelHidden(false);
    }
}

function closeChangesPanel(): void {
    changesOpenedHere.value = false;
    if (changesPanelAuto.value) {
        void setChangesPanelHidden(true);
    }
}

function showChanges(messageId: string): void {
    selectedChangesId.value = messageId;
    if (changesPanelAvailable.value) {
        openChangesPanel();
    }
    else {
        changesOverlayOpen.value = true;
    }
}

let unsubscribe: (() => void) | undefined;
let contentObserver: ResizeObserver | undefined;

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
    if (!sentThisVisit || !pinSentMessage.value || !lastUserMessage) {
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

const settled = ref(false);
const skeletonDue = ref(false);
const skeletonTimer = setTimeout(() => {
    skeletonDue.value = true;
}, SKELETON_DELAY_MS);

function settleLayout(): Promise<void> {
    return new Promise((resolve) => {
        const started = performance.now();
        let height = -1;
        let stableSince = started;
        const check = (now: number) => {
            const current = scroller().scrollHeight;
            if (current !== height) {
                height = current;
                stableSince = now;
            }
            if (now - stableSince >= SETTLE_QUIET_MS || now - started >= SETTLE_MAX_MS) {
                resolve();
                return;
            }
            requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
    });
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

async function showLatestAtBottom(): Promise<void> {
    await nextTick();
    scroller().scrollTop = scroller().scrollHeight;
    atBottom.value = true;
}

watch(() => visibleMessages.value.at(-1), (message, previous) => {
    if (sentThisVisit && message?.role === 'user' && message.id !== previous?.id) {
        void (pinSentMessage.value ? alignLatestUserMessage() : showLatestAtBottom());
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
    await settleLayout();
    scroller().scrollTop = scroller().scrollHeight;
    settled.value = true;
    onScroll();
    readAlong.mark();
    readAlong.revealIfRequested(releaseBottom);
});

onBeforeUnmount(() => {
    unsubscribe?.();
    USER_SCROLL_EVENTS.forEach(name => window.removeEventListener(name, releaseBottom));
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('scrollend', keepPinnedMessageInPlace);
    clearTimeout(unpinTimer);
    clearTimeout(skeletonTimer);
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
        const reply = readAnswers(messageText(message));
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

function pickOption(line: string, siblings: string[]): void {
    const draft = input.value.trimStart();
    const [first = '', ...rest] = draft.split('\n');
    const remainder = siblings.includes(first.trim()) ? rest.join('\n').trimStart() : draft;
    input.value = remainder ? `${line}\n\n${remainder}` : line;
    focusComposerAtEnd();
}

function replyTo(messageId: string): string | undefined {
    const index = visibleMessages.value.findIndex(message => message.id === messageId);
    const reply = index === -1 ? undefined : visibleMessages.value.slice(index + 1).find(message => message.role === 'user');
    return reply ? messageText(reply) : undefined;
}

provide(blockPicksKey, { messageId: answerableMessageId, draft: input, reply: replyTo, pick: pickOption });
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
function neighbourConversationPath(): string {
    const index = conversations.value.findIndex(conversation => conversation.id === conversationId);
    const neighbour = index === -1 ? undefined : conversations.value[index + 1] ?? conversations.value[index - 1];
    return neighbour ? `/c/${neighbour.id}` : '/';
}

const archiveConversation = () => withFlag(archiving, async () => {
    const next = neighbourConversationPath();
    await archive();
    await navigateTo(next);
});
const restoreConversation = () => withFlag(archiving, restore);

</script>

<template>
    <UDashboardPanel :id="`conversation-${conversationId}`" :ui="{ root: '@container', body: 'px-0 sm:px-0' }">
        <template #header>
            <div ref="header" class="sticky top-0 z-30 bg-default/70 backdrop-blur-md backdrop-saturate-150">
                <UDashboardNavbar :title="title" class="h-14 bg-transparent">
                    <template #title>
                        <ChatTitleEditor :title="title" :editable="loaded && archivedAt === null" :save="rename" />
                    </template>
                    <template #right>
                        <template v-if="archivedAt !== null">
                            <UBadge :label="t('Archived')" color="neutral" variant="subtle" size="lg" class="h-9 px-3" />
                            <UButton
                                :label="t('Restore')"
                                icon="i-heroicons-arrow-uturn-left"
                                color="neutral"
                                variant="outline"
                                class="bg-default dark:bg-transparent"
                                :loading="archiving"
                                @click="restoreConversation"
                            />
                        </template>
                        <ChatParticipants v-if="loaded" :participants="participants" :agent-options="agentOptions" :editable="archivedAt === null" @toggle="setAgent" />
                        <template v-if="archivedAt === null && loaded">
                            <UTooltip v-if="status === 'running'" :text="t('Pause session')">
                                <UButton
                                    :aria-label="t('Pause session')"
                                    icon="i-heroicons-pause"
                                    color="neutral"
                                    variant="outline"
                                    class="h-9.5 bg-default max-sm:w-9.5 max-sm:justify-center max-sm:px-0 dark:bg-transparent"
                                    :loading="pausing"
                                    @click="pauseConversation"
                                >
                                    <span class="max-sm:hidden">{{ t('Pause session') }}</span>
                                </UButton>
                            </UTooltip>
                            <UTooltip v-if="hub" :text="muted ? t('Unmute') : t('Mute')">
                                <UButton
                                    :icon="muted ? 'i-heroicons-bell-slash' : 'i-heroicons-bell'"
                                    :aria-label="muted ? t('Unmute') : t('Mute')"
                                    color="neutral"
                                    variant="outline"
                                    class="size-9.5 justify-center bg-default dark:bg-transparent"
                                    :loading="muting"
                                    @click="toggleMute"
                                />
                            </UTooltip>
                            <UTooltip :text="t('Archive')">
                                <UButton
                                    icon="i-heroicons-archive-box"
                                    :aria-label="t('Archive')"
                                    color="neutral"
                                    variant="outline"
                                    class="size-9.5 justify-center bg-default dark:bg-transparent"
                                    :loading="archiving"
                                    @click="archiveConversation"
                                />
                            </UTooltip>
                        </template>
                    </template>
                </UDashboardNavbar>
            </div>
        </template>

        <template #body>
            <div class="mx-auto w-full px-4 @min-[48rem]:w-[min(48rem,calc(100cqw-15rem))] @min-[48rem]:px-0 flex-1">
                <div ref="timeline" />
                <ChatQuoteButton v-if="loaded && archivedAt === null" :root="timeline?.parentElement ?? null" @quote="quote" />
                <div v-if="!loaded && skeletonDue" class="flex flex-col gap-6 py-4">
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
                        :class="{ invisible: !settled }"
                        :messages="visibleMessages"
                        :status="chatStatus"
                        :auto-scroll="false"
                        :style="{ '--last-message-height': `${answerSpace}px`, '--message-scroll-margin': `${messageScrollMargin}px` }"
                        :ui="{ root: 'px-0 [&>article]:scroll-mt-(--message-scroll-margin) [&>article[data-role=assistant]+article[data-role=assistant]:not(:has([data-follow-up]))]:mt-6 [&>article:has([data-follow-up])]:-mt-5' }"
                        :should-scroll-to-bottom="false"
                        :assistant="{ side: 'left', variant: 'naked', ui: { container: 'flex-col gap-1.5 pb-7 @min-[48rem]:flex-row @min-[48rem]:gap-3', leading: 'mt-0 self-start @min-[48rem]:-ms-[6.75rem]', content: 'text-base/6.5', actions: 'h-6 gap-1' } }"
                        :user="{ side: 'right', variant: 'soft', ui: { container: 'max-w-[90%] flex-col items-end gap-1.5 pb-7 @min-[40rem]:max-w-[75%] @min-[48rem]:flex-row-reverse @min-[48rem]:items-start @min-[48rem]:justify-start @min-[48rem]:gap-3', leading: 'mt-0 self-end @min-[48rem]:self-start @min-[48rem]:-me-[6.75rem]', body: 'max-w-full', actions: 'h-6 gap-1', content: 'min-h-0 rounded-[1.125rem] bg-(--user-message) px-3.5 py-2 text-base/6.5' } }"
                    >
                        <template #leading="{ message }">
                            <ChatHead
                                :participant="messageAuthor(message)"
                                :reverse="message.role === 'user'"
                                :class="followUpIds.has(message.id) ? 'invisible @max-[48rem]:hidden' : ''"
                                :data-follow-up="followUpIds.has(message.id) || undefined"
                            />
                        </template>
                        <template #indicator="{ ui }">
                            <div class="flex items-center gap-2.5">
                                <div data-slot="indicator" :class="ui.indicator()">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                                <span v-if="startingSession" class="text-sm text-muted">{{ t('Starting…') }}</span>
                            </div>
                        </template>
                        <template #content="{ message }">
                            <div
                                class="contents"
                                :data-read-along="message.id"
                                :data-reading="readAlong.playingId.value === message.id || undefined"
                                @click="event => readAlong.jumpToClicked(event, message.id)"
                            >
                                <div v-if="message.role === 'assistant'" class="mb-3 flex flex-col empty:hidden">
                                    <ChatThinkingBlock :message="message" :streaming="isStreaming(message.id)" />
                                    <ChatWorkingBlock :message="message" :streaming="isStreaming(message.id)" :file-changes-shown="changesPanelShown" />
                                    <ChatTurnChanges :message="message" :shown="changesShownFor(message.id)" @show="showChanges(message.id)" />
                                </div>
                                <template v-for="segment in answerSegments(message)" :key="`${segment.key}:${mentionKey}`">
                                    <ChatImageGroup v-if="segment.kind === 'images'" :parts="segment.parts" />
                                    <p v-else-if="segment.kind === 'stop-hook'" class="mt-1 flex items-start gap-2 pb-2 text-sm text-muted">
                                        <UTooltip :text="t('Stop hook')">
                                            <UIcon name="i-heroicons-shield-check" class="mt-0.5 size-4 shrink-0" />
                                        </UTooltip>
                                        <span class="sr-only">{{ t('Stop hook') }}</span>
                                        <span class="flex min-w-0 flex-col gap-1">
                                            <span v-for="(paragraph, line) in segment.paragraphs" :key="line" class="whitespace-pre-line" :class="line === 0 ? 'font-medium' : ''">{{ paragraph }}</span>
                                        </span>
                                    </p>
                                    <template v-else-if="segment.kind === 'compacted'">
                                        <p v-if="!segment.running || isStreaming(message.id)" class="mb-3 flex items-center gap-2 text-sm text-muted" :role="segment.running ? 'status' : undefined">
                                            <span v-if="segment.running" class="relative flex size-4 shrink-0 items-center justify-center" aria-hidden="true">
                                                <span class="absolute inline-flex size-2 rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
                                                <span class="relative inline-flex size-2 rounded-full bg-primary shadow-[0_0_6px_1px_var(--ui-primary)]" />
                                            </span>
                                            <UIcon v-else name="i-heroicons-arrows-pointing-in" class="size-4 shrink-0" />
                                            <span v-if="segment.running" class="light-streak [--light-streak:white]">{{ t('Summarizing conversation…') }}</span>
                                            <template v-else>
                                                {{ t('Conversation summarized') }}
                                            </template>
                                        </p>
                                    </template>
                                    <ChatUiBlock v-else-if="segment.kind === 'ui-block'" :block="segment.block" :message-id="message.id" />
                                    <ChatMessagePart v-else :part="segment.part" :message="message" :streaming="isStreaming(message.id)" />
                                </template>
                                <ChatTurnOutcome v-if="message.role === 'assistant'" :message="message" />
                            </div>
                        </template>
                        <template #actions="{ message }">
                            <template v-if="!isStreaming(message.id)">
                                <ChatCopyButton v-if="messageText(message)" :text="messageText(message)" />
                                <ChatSpeakButton v-if="messageText(message)" :text="messageText(message)" :message-id="message.id" />
                                <span class="px-1 text-xs text-muted tabular-nums">{{ formatClockTime(message.metadata!.createdAt) }}</span>
                            </template>
                        </template>
                    </UChatMessages>
                </template>
            </div>
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
                        <UTooltip :text="t('Jump to latest')">
                            <UButton
                                icon="i-heroicons-arrow-down"
                                :aria-label="t('Jump to latest')"
                                color="neutral"
                                variant="outline"
                                class="pointer-events-auto bg-default shadow-lg"
                                @click="jumpToBottom"
                            />
                        </UTooltip>
                    </div>
                </Transition>
                <div class="mx-auto w-full px-4 @min-[48rem]:w-[min(48rem,calc(100cqw-15rem))] @min-[48rem]:px-0 pb-4 sm:pb-6">
                    <ChatSignInNotice v-if="accountLoaded && !account" class="mb-2" />
                    <ChatUsageNotice v-else class="mb-2" />
                    <ChatBackgroundTasks v-if="backgroundTasks.length > 0" :tasks="backgroundTasks" class="mb-2" />
                    <ChatQueuedMessages v-if="queuedMessages.length > 0" :messages="queuedMessages" :recipient-name="agentName" class="mb-2" />
                    <div v-if="SHOW_TYPING_LINE" class="mb-1.5 flex h-6 items-center px-3.5">
                        <Transition enter-active-class="transition-opacity duration-150 ease-out" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150 ease-in" leave-to-class="opacity-0">
                            <div v-if="typingAgent" class="min-w-0 truncate text-xs text-muted">
                                <i18n-t keypath="{name} is typing…" scope="global">
                                    <template #name>
                                        <span class="font-medium text-toned">{{ typingAgent.name }}</span>
                                    </template>
                                </i18n-t>
                            </div>
                        </Transition>
                    </div>
                    <div class="relative">
                        <Transition enter-active-class="transition-opacity duration-150 ease-out" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-150 ease-in" leave-to-class="opacity-0">
                            <p v-if="stopArmed" class="pointer-events-none absolute inset-x-0 -top-6 text-center text-xs text-muted">{{ t('Press Esc again to stop') }}</p>
                        </Transition>
                    </div>
                    <SpeechPlayer class="mb-2 lg:hidden" />
                    <ChatComposer
                        v-model="input"
                        :placeholder="t('Send a message…')"
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
                </div>
            </div>
        </template>
    </UDashboardPanel>
    <ChatChangesPanel
        v-if="changesPanelShown && changesMessage"
        :message="changesMessage"
        :streaming="isStreaming(changesMessage.id)"
        :max-width="changesPanelRoom"
        @close="closeChangesPanel"
    />
    <USlideover
        v-if="changesMessage"
        v-model:open="changesOverlayOpen"
        :title="t('Changes')"
        :description="changesTitle(turnFileChanges(changesMessage).files)"
        :ui="{ content: 'sm:max-w-3xl', body: 'scrollbar-slim flex flex-col-reverse' }"
    >
        <template #body>
            <ChatChangesFiles :message="changesMessage" :live="false" />
        </template>
    </USlideover>
</template>
