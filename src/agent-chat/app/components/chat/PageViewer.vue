<script setup lang="ts">
defineProps<{
    src: string;
    title: string;
}>();

const open = defineModel<boolean>('open', { required: true });

const { t } = useI18n();

const MIN_WIDTH = 320;

const stage = ref<HTMLElement | null>(null);
const stageWidth = ref(0);
const frameWidth = ref<number | null>(null);
const dragging = ref(false);
const shownWidth = computed(() => frameWidth.value ?? stageWidth.value);

let observer: ResizeObserver | undefined;

watch(stage, (element) => {
    observer?.disconnect();
    if (!element) {
        return;
    }
    observer = new ResizeObserver(([entry]) => {
        stageWidth.value = entry!.contentRect.width;
    });
    observer.observe(element);
});

watch(open, (isOpen) => {
    if (isOpen) {
        frameWidth.value = null;
    }
});

onBeforeUnmount(() => observer?.disconnect());

function startResize(event: PointerEvent): void {
    const startX = event.clientX;
    const startWidth = shownWidth.value;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    dragging.value = true;
    const move = (moved: PointerEvent): void => {
        const width = startWidth + (moved.clientX - startX) * 2;
        frameWidth.value = Math.min(Math.max(width, MIN_WIDTH), stageWidth.value);
    };
    const stop = (): void => {
        dragging.value = false;
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
}

function resetWidth(): void {
    frameWidth.value = null;
}

const frameStyle = computed(() => (frameWidth.value === null ? { width: '100%' } : { width: `${frameWidth.value}px` }));
</script>

<template>
    <UModal
        v-model:open="open"
        :title="title"
        :ui="{ content: 'w-[min(96vw,1600px)] max-w-none h-[calc(100vh-1rem)] max-h-none', body: 'flex flex-1 p-0 sm:p-0 overflow-hidden', footer: 'justify-between' }"
    >
        <template #body>
            <div ref="stage" class="flex flex-1 justify-center bg-muted px-4">
                <div class="relative h-full" :style="frameStyle">
                    <iframe
                        :src="src"
                        :title="title"
                        sandbox="allow-scripts"
                        class="block size-full bg-white"
                        :class="{ 'pointer-events-none': dragging }"
                    />
                    <div
                        role="separator"
                        aria-orientation="vertical"
                        :aria-label="t('Width')"
                        class="group absolute inset-y-0 -end-3 flex w-3 cursor-ew-resize touch-none items-center justify-center"
                        @pointerdown.prevent="startResize"
                        @dblclick="resetWidth"
                    >
                        <span class="h-10 w-1 rounded-full bg-accented transition-colors duration-500 ease-out group-hover:bg-primary" :class="{ 'bg-primary': dragging }" />
                    </div>
                </div>
            </div>
        </template>
        <template #footer>
            <span class="text-sm text-muted tabular-nums">{{ t('Width') }}: {{ formatPixels(shownWidth) }}</span>
            <UButton :label="t('Close')" color="neutral" variant="outline" @click="open = false" />
        </template>
    </UModal>
</template>
