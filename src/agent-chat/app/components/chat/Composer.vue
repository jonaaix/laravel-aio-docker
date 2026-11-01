<script setup lang="ts">
import type { ChatStatus } from 'ai';
import type { CSSProperties } from 'vue';

const MAX_ROWS = 10;
const BAR_ROOM_PX = 12;
const QUOTE_LINE = /^(>\s?)(.*)$/;
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
}>();

const emit = defineEmits<{ submit: []; stop: [] }>();

const empty = computed(() => text.value.trim() === '');
const busy = computed(() => props.status === 'submitted' || props.status === 'streaming');

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
</script>

<template>
    <div ref="wrapper" class="relative" @scroll.capture="syncScroll">
        <UChatPrompt
            v-model="text"
            variant="outline"
            color="neutral"
            :placeholder="placeholder"
            :error="error"
            :disabled="disabled"
            :autofocus="autofocus"
            :maxrows="MAX_ROWS"
            :ui="{
                body: 'items-end ps-3',
                base: ['py-2 text-base/5 transition-none', hasQuote ? 'text-transparent caret-[var(--ui-text-highlighted)]' : ''],
            }"
            @submit="emit('submit')"
        >
            <UTooltip :text="busy ? 'Stop' : 'Send'">
                <UChatPromptSubmit
                    :status="props.status"
                    :disabled="props.status === 'ready' && empty"
                    :aria-label="busy ? 'Stop' : 'Send'"
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
