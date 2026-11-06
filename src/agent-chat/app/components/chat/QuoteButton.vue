<script setup lang="ts">
const SETTLE_MS = 200;
const GAP_PX = 8;

const props = defineProps<{
    root: HTMLElement | null;
}>();

const emit = defineEmits<{ quote: [text: string] }>();

const { t } = useI18n();

const position = ref<{ top: number; left: number } | null>(null);
let selectedText = '';
let settle: ReturnType<typeof setTimeout> | undefined;
let pointerDown = false;

function selectedRange(): Range | null {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return null;
    }
    const range = selection.getRangeAt(0);
    return props.root?.contains(range.commonAncestorContainer) ? range : null;
}

function endOfSelection(range: Range): { top: number; left: number } | null {
    const selection = window.getSelection()!;
    const rects = [...range.getClientRects()].filter(rect => rect.width > 0);
    const backward = range.startContainer === selection.focusNode && range.startOffset === selection.focusOffset;
    const rect = backward ? rects[0] : rects.at(-1);
    return rect ? { top: rect.top - GAP_PX, left: backward ? rect.left : rect.right } : null;
}

function update(): void {
    const range = selectedRange();
    const text = range?.toString().trim() ?? '';
    position.value = range && text ? endOfSelection(range) : null;
    selectedText = text;
}

function onSelectionChange(): void {
    clearTimeout(settle);
    if (!selectedRange()) {
        position.value = null;
        return;
    }
    if (!pointerDown) {
        settle = setTimeout(update, SETTLE_MS);
    }
}

function onPointerDown(event: PointerEvent): void {
    if (event.button === 0) {
        pointerDown = true;
    }
}

function onPointerUp(): void {
    if (pointerDown) {
        pointerDown = false;
        onSelectionChange();
    }
}

function onScroll(): void {
    if (position.value) {
        update();
    }
}

function quote(): void {
    emit('quote', selectedText);
    window.getSelection()?.removeAllRanges();
    position.value = null;
}

useActiveListener(() => document, 'selectionchange', onSelectionChange);
useActiveListener(() => document, 'pointerdown', onPointerDown);
useActiveListener(() => document, 'pointerup', onPointerUp);
useActiveListener(() => document, 'pointercancel', onPointerUp);
useActiveListener(() => window, 'scroll', onScroll, { passive: true });
onDeactivated(() => {
    position.value = null;
});
onBeforeUnmount(() => clearTimeout(settle));
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition-opacity duration-[180ms] ease-out"
            leave-active-class="transition-opacity duration-[160ms] ease-in"
            enter-from-class="opacity-0"
            leave-to-class="opacity-0"
        >
            <div
                v-if="position"
                class="fixed z-20 -translate-x-1/2 -translate-y-full"
                :style="{ top: `${position.top}px`, left: `${position.left}px` }"
            >
                <UButton
                    :label="t('Quote')"
                    icon="i-heroicons-chat-bubble-bottom-center-text"
                    color="neutral"
                    variant="solid"
                    class="shadow-lg hover:bg-[color-mix(in_oklab,var(--ui-bg-inverted)_90%,var(--ui-bg))] active:bg-[color-mix(in_oklab,var(--ui-bg-inverted)_90%,var(--ui-bg))]"
                    @mousedown.prevent
                    @click="quote"
                />
            </div>
        </Transition>
    </Teleport>
</template>
