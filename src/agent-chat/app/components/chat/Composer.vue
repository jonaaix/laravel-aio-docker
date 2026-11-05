<script setup lang="ts">
import type { ChatStatus } from 'ai';
import type { CSSProperties } from 'vue';
import type { PendingAttachment } from '~/composables/useAttachments';
import type { Participant } from '~/utils/avatars';

const MAX_ROWS = 10;
const BAR_ROOM_PX = 12;
const QUOTE_LINE = /^(>\s?)(.*)$/;
const MENTION_QUERY = /(^|\s)@([^@\n]{0,40})$/;
const MAX_SUGGESTIONS = 6;
const MIRRORED_STYLES = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'whiteSpace',
    'overflowWrap',
    'wordBreak',
    'tabSize',
] as const;

const text = defineModel<string>({ required: true });

const props = defineProps<{
    placeholder: string;
    status: ChatStatus;
    error?: Error;
    disabled?: boolean;
    autofocus?: boolean;
    attachments: PendingAttachment[];
    uploading: boolean;
    mentions?: Participant[];
}>();

const emit = defineEmits<{ submit: []; stop: []; attach: [files: File[]]; remove: [key: string] }>();

const { t } = useI18n();

const empty = computed(() => text.value.trim() === '' && !props.attachments.some(attachment => attachment.upload));
const fileInput = ref<HTMLInputElement | null>(null);

function pickFiles(): void {
    fileInput.value?.click();
}

function onPicked(): void {
    const files = [...(fileInput.value?.files ?? [])];
    if (files.length > 0) {
        emit('attach', files);
    }
    fileInput.value!.value = '';
}

function onPaste(event: ClipboardEvent): void {
    const files = [...(event.clipboardData?.files ?? [])];
    if (files.length > 0) {
        event.preventDefault();
        emit('attach', files);
    }
}
const busy = computed(() => props.status === 'submitted' || props.status === 'streaming');
const stoppable = computed(() => busy.value && empty.value);

const wrapper = ref<HTMLElement | null>(null);
const mirror = ref<HTMLElement | null>(null);
const mirrorStyle = ref<CSSProperties>({});

const lines = computed(() => text.value.split('\n').map((line) => {
    const match = QUOTE_LINE.exec(line);
    return match ? { quote: true, marker: match[1]!, content: match[2]! } : { quote: false, marker: '', content: line };
}));
const hasQuote = computed(() => lines.value.some(line => line.quote));

function textarea(): HTMLTextAreaElement | null {
    return wrapper.value?.querySelector('textarea') ?? null;
}

function syncScroll(): void {
    const field = textarea();
    if (mirror.value && field) {
        mirror.value.scrollTop = field.scrollTop;
    }
}

function measure(): void {
    const field = textarea();
    if (!field || !wrapper.value) {
        return;
    }
    const computedStyle = getComputedStyle(field);
    const fieldRect = field.getBoundingClientRect();
    const wrapperRect = wrapper.value.getBoundingClientRect();
    const style: CSSProperties = {
        top: `${fieldRect.top - wrapperRect.top + field.clientTop}px`,
        left: `${fieldRect.left - wrapperRect.left + field.clientLeft - BAR_ROOM_PX}px`,
        width: `${field.clientWidth + BAR_ROOM_PX}px`,
        height: `${field.clientHeight}px`,
        paddingLeft: `${Number.parseFloat(computedStyle.paddingLeft) + BAR_ROOM_PX}px`,
    };
    for (const key of MIRRORED_STYLES) {
        (style as Record<string, string>)[key] = computedStyle[key];
    }
    mirrorStyle.value = style;
    nextTick(syncScroll);
}

let observer: ResizeObserver | undefined;

watch(hasQuote, async (quoted) => {
    observer?.disconnect();
    if (!quoted) {
        return;
    }
    await nextTick();
    const field = textarea();
    if (field) {
        observer = new ResizeObserver(measure);
        observer.observe(field);
    }
    measure();
}, { flush: 'post' });

watch(text, () => {
    if (hasQuote.value) {
        nextTick(measure);
    }
});

onBeforeUnmount(() => observer?.disconnect());

const caret = ref(0);
const activeSuggestion = ref(0);
const dismissed = ref(false);

function updateCaret(): void {
    caret.value = textarea()?.selectionStart ?? text.value.length;
}

const mentionQuery = computed(() => MENTION_QUERY.exec(text.value.slice(0, caret.value))?.[2] ?? null);
const suggestions = computed(() => {
    const query = mentionQuery.value?.toLowerCase();
    if (query === undefined || dismissed.value) {
        return [];
    }
    return (props.mentions ?? []).filter(participant => participant.name.toLowerCase().startsWith(query)).slice(0, MAX_SUGGESTIONS);
});

watch(text, () => {
    dismissed.value = false;
    nextTick(updateCaret);
});
watch(suggestions, () => {
    activeSuggestion.value = 0;
});

const speechProvider = useSpeechProvider();
const dictation = useDictation(insertDictation);

async function insertDictation(spoken: string): Promise<void> {
    const position = Math.min(caret.value, text.value.length);
    const before = text.value.slice(0, position);
    const after = text.value.slice(position);
    const inserted = `${before && !/\s$/.test(before) ? ' ' : ''}${spoken}${after && !/^\s/.test(after) ? ' ' : ''}`;
    text.value = `${before}${inserted}${after}`;
    await nextTick();
    const field = textarea();
    field?.focus();
    field?.setSelectionRange(position + inserted.length, position + inserted.length);
    updateCaret();
}

async function pickMention(participant: Participant): Promise<void> {
    const before = text.value.slice(0, caret.value);
    const start = before.lastIndexOf('@');
    const inserted = `@${participant.name} `;
    text.value = `${text.value.slice(0, start)}${inserted}${text.value.slice(caret.value)}`;
    await nextTick();
    const field = textarea();
    field?.focus();
    field?.setSelectionRange(start + inserted.length, start + inserted.length);
    updateCaret();
}

function isNewlineShortcut(event: KeyboardEvent): boolean {
    return event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.code === 'KeyJ';
}

async function insertNewline(): Promise<void> {
    const field = textarea();
    if (!field) {
        return;
    }
    const start = field.selectionStart;
    text.value = `${text.value.slice(0, start)}\n${text.value.slice(field.selectionEnd)}`;
    await nextTick();
    field.setSelectionRange(start + 1, start + 1);
    updateCaret();
}

function onKeydown(event: KeyboardEvent): void {
    if (isNewlineShortcut(event)) {
        event.preventDefault();
        void insertNewline();
        return;
    }
    if (suggestions.value.length === 0) {
        return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        activeSuggestion.value = (activeSuggestion.value + step + suggestions.value.length) % suggestions.value.length;
    }
    else if (event.key === 'Enter' || event.key === 'Tab') {
        void pickMention(suggestions.value[activeSuggestion.value]!);
    }
    else if (event.key === 'Escape') {
        dismissed.value = true;
    }
    else {
        return;
    }
    event.preventDefault();
    event.stopPropagation();
}
</script>

<template>
    <div
        ref="wrapper"
        class="relative"
        @scroll.capture="syncScroll"
        @paste.capture="onPaste"
        @keydown.capture="onKeydown"
        @keyup.capture="updateCaret"
        @click.capture="updateCaret"
    >
        <ul
            v-if="suggestions.length > 0"
            class="absolute bottom-full start-0 z-20 mb-2 w-64 rounded-md bg-default p-1 shadow-lg ring ring-default"
            role="listbox"
            :aria-label="t('Mention')"
        >
            <li
                v-for="(participant, index) in suggestions"
                :key="`${participant.kind}:${participant.name}`"
                role="option"
                :aria-selected="index === activeSuggestion"
                class="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm"
                :class="index === activeSuggestion ? 'bg-elevated text-highlighted' : 'text-default'"
                @mousedown.prevent="pickMention(participant)"
                @mouseenter="activeSuggestion = index"
            >
                <span class="flex size-6 shrink-0 items-center justify-center">
                    <ParticipantAvatar :participant="participant" :class="isVoxelBot(participant) ? 'size-6' : 'size-5'" />
                </span>
                <span class="min-w-0 truncate">{{ participant.name }}</span>
            </li>
        </ul>
        <UChatPrompt
            v-model="text"
            variant="outline"
            color="neutral"
            :placeholder="placeholder"
            :error="error ?? dictation.error.value"
            :disabled="disabled"
            :autofocus="autofocus"
            :maxrows="MAX_ROWS"
            :ui="{
                body: 'items-end gap-1.5',
                base: ['scrollbar-slim rounded-none py-2 ps-0 text-base/5 transition-none', hasQuote ? 'text-transparent caret-[var(--ui-text-highlighted)]' : ''],
                leading: 'static order-first inset-auto ps-0',
            }"
            @submit="emit('submit')"
        >
            <template v-if="attachments.length > 0" #header>
                <ChatAttachmentChips :attachments="attachments" @remove="key => emit('remove', key)" />
            </template>
            <template #leading>
                <UTooltip :text="t('Attach files')">
                    <UButton
                        icon="i-heroicons-paper-clip"
                        :aria-label="t('Attach files')"
                        color="neutral"
                        variant="ghost"
                        :disabled="disabled"
                        @click="pickFiles"
                    />
                </UTooltip>
                <input ref="fileInput" type="file" multiple class="hidden" @change="onPicked">
            </template>
            <span v-if="dictation.state.value === 'recording'" aria-hidden="true" class="flex h-9 shrink-0 items-center gap-0.5">
                <span
                    v-for="(level, index) in dictation.levels.value"
                    :key="index"
                    class="w-0.5 rounded-full bg-error transition-[height] duration-75 ease-out"
                    :style="{ height: `${4 + level * 20}px` }"
                />
            </span>
            <UTooltip v-if="speechProvider" :text="dictation.state.value === 'recording' ? t('Stop dictation') : t('Dictate')">
                <UButton
                    :icon="dictation.state.value === 'recording' ? 'i-heroicons-stop' : 'i-heroicons-microphone'"
                    :aria-label="dictation.state.value === 'recording' ? t('Stop dictation') : t('Dictate')"
                    :loading="dictation.state.value === 'transcribing'"
                    :color="dictation.state.value === 'recording' ? 'error' : 'neutral'"
                    :variant="dictation.state.value === 'recording' ? 'soft' : 'ghost'"
                    :disabled="disabled"
                    class="shrink-0"
                    @click="dictation.toggle"
                />
            </UTooltip>
            <UTooltip :text="stoppable ? t('Stop') : t('Send')">
                <UChatPromptSubmit
                    :status="stoppable ? props.status : 'ready'"
                    :disabled="!stoppable && (empty || uploading)"
                    :aria-label="stoppable ? t('Stop') : t('Send')"
                    color="neutral"
                    class="shrink-0 disabled:opacity-40"
                    @stop="emit('stop')"
                />
            </UTooltip>
        </UChatPrompt>

        <div
            v-if="hasQuote"
            ref="mirror"
            aria-hidden="true"
            class="pointer-events-none absolute overflow-hidden text-highlighted"
            :style="mirrorStyle"
        >
            <div
                v-for="(line, index) in lines"
                :key="index"
                :class="line.quote ? 'relative text-toned before:absolute before:inset-y-0 before:-start-2.5 before:w-[3px] before:rounded-full before:bg-accented' : ''"
            >
                <span v-if="line.quote" class="text-transparent">{{ line.marker }}</span>{{ line.content || '​' }}
            </div>
        </div>
    </div>
</template>
