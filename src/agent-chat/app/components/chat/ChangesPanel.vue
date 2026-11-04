<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';
import { CHANGES_PANEL_MIN_PX } from '~/composables/useChangesPanelRoom';

const DEFAULT_WIDTH_PX = 544;
const WIDTH_STORAGE_KEY = 'chat-changes-panel-width';

const props = defineProps<{
    message: ChatMessage;
    streaming: boolean;
    maxWidth: number;
}>();

const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();

const changesTitle = useChangesTitle();
const files = computed(() => turnFileChanges(props.message).files);

function clampedWidth(value: number): number {
    return Math.max(CHANGES_PANEL_MIN_PX, value);
}

function storedWidth(): number {
    try {
        const stored = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
        return stored ? clampedWidth(stored) : DEFAULT_WIDTH_PX;
    }
    catch {
        return DEFAULT_WIDTH_PX;
    }
}

const width = ref(DEFAULT_WIDTH_PX);
const shownWidth = computed(() => Math.min(width.value, props.maxWidth));
const dragging = ref(false);

function saveWidth(): void {
    try {
        localStorage.setItem(WIDTH_STORAGE_KEY, String(width.value));
    }
    catch {
        return;
    }
}

function startResize(event: MouseEvent): void {
    const startX = event.clientX;
    const startWidth = shownWidth.value;
    dragging.value = true;
    const move = (moved: MouseEvent) => {
        width.value = Math.min(props.maxWidth, clampedWidth(startWidth + startX - moved.clientX));
    };
    const stop = () => {
        dragging.value = false;
        saveWidth();
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', stop);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
}

function resetWidth(): void {
    width.value = DEFAULT_WIDTH_PX;
    saveWidth();
}

onMounted(() => {
    width.value = storedWidth();
});
</script>

<template>
    <UDashboardResizeHandle
        :class="dragging ? 'after:bg-primary' : ''"
        :aria-label="t('Resize changes')"
        @mousedown.prevent="startResize"
        @dblclick="resetWidth"
    />
    <aside class="sticky top-0 flex h-svh shrink-0 flex-col self-start bg-default" :style="{ width: `${shownWidth}px` }">
        <div class="flex h-14 shrink-0 items-center gap-3 px-4">
            <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold text-highlighted">{{ t('Changes') }}</p>
                <p class="text-xs text-muted tabular-nums">
                    {{ changesTitle(files) }}
                </p>
            </div>
            <UTooltip :text="t('Close changes')">
                <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" :aria-label="t('Close changes')" @click="emit('close')" />
            </UTooltip>
        </div>
        <div class="scrollbar-slim flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-4 pb-4">
            <ChatChangesFiles :message="message" :live="streaming" />
        </div>
    </aside>
</template>
