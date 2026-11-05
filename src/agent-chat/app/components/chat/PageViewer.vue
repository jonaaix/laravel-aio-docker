<script setup lang="ts">
import type { OptionStripItem } from '~/components/OptionStrip.vue';

defineProps<{
    src: string;
    fileUrl: string;
    filename: string;
    title: string;
}>();

const open = defineModel<boolean>('open', { required: true });

const { t } = useI18n();

const MIN_WIDTH = 320;

type ScreenPreset = 'iphone' | 'macbook' | 'full-hd' | 'uhd';

const SCREEN_WIDTHS: Record<ScreenPreset, number> = { 'iphone': 402, 'macbook': 1470, 'full-hd': 1920, 'uhd': 2560 };

const screenOptions: OptionStripItem<ScreenPreset>[] = [
    { value: 'iphone', label: 'iPhone 16 Pro' },
    { value: 'macbook', label: 'MacBook Air 13″' },
    { value: 'full-hd', label: 'Full HD' },
    { value: 'uhd', label: '4K 27″' },
];

const stage = ref<HTMLElement | null>(null);
const stageSize = reactive({ width: 0, height: 0 });
const frameWidth = ref<number | null>(null);
const dragging = ref(false);
const codeOpen = ref(false);
const codeMounted = ref(false);

const shownWidth = computed(() => frameWidth.value ?? stageSize.width);
const scale = computed(() => (stageSize.width > 0 ? Math.min(1, stageSize.width / shownWidth.value) : 1));
const preset = computed<ScreenPreset | ''>({
    get: () => (Object.entries(SCREEN_WIDTHS).find(([, width]) => width === frameWidth.value)?.[0] as ScreenPreset | undefined) ?? '',
    set: (value) => {
        if (value) {
            frameWidth.value = SCREEN_WIDTHS[value];
        }
    },
});

let observer: ResizeObserver | undefined;

watch(stage, (element) => {
    observer?.disconnect();
    if (!element) {
        return;
    }
    observer = new ResizeObserver(([entry]) => {
        stageSize.width = entry!.contentRect.width;
        stageSize.height = entry!.contentRect.height;
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
    const startWidth = shownWidth.value * scale.value;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    dragging.value = true;
    const move = (moved: PointerEvent): void => {
        const width = startWidth + (moved.clientX - startX) * 2;
        frameWidth.value = Math.round(Math.min(Math.max(width, MIN_WIDTH), stageSize.width));
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

function showCode(): void {
    codeMounted.value = true;
    codeOpen.value = true;
}

function resetWidth(): void {
    frameWidth.value = null;
}

const frameBoxStyle = computed(() => (frameWidth.value === null ? { width: '100%' } : { width: `${shownWidth.value * scale.value}px` }));
const frameStyle = computed(() => (scale.value === 1
    ? { width: '100%', height: '100%' }
    : { width: `${shownWidth.value}px`, height: `${stageSize.height / scale.value}px`, transform: `scale(${scale.value})`, transformOrigin: 'top left' }));
</script>

<template>
    <UModal
        v-model:open="open"
        :title="title"
        :ui="{ content: 'w-[min(96vw,1600px)] max-w-none h-[calc(100vh-1rem)] max-h-none sm:max-h-none', body: 'flex flex-1 p-0 sm:p-0 overflow-hidden', footer: 'justify-between' }"
    >
        <template #actions>
            <UTooltip :text="t('View code')">
                <UButton icon="i-heroicons-code-bracket" color="neutral" variant="ghost" class="size-7 justify-center p-0" :aria-label="t('View code')" @click="showCode" />
            </UTooltip>
            <UTooltip :text="t('Open in new tab')">
                <UButton icon="i-heroicons-arrow-top-right-on-square" color="neutral" variant="ghost" class="size-7 justify-center p-0" :aria-label="t('Open in new tab')" :to="src" target="_blank" external />
            </UTooltip>
        </template>
        <template #body>
            <div ref="stage" class="flex flex-1 justify-center overflow-hidden bg-muted px-4">
                <div class="relative h-full" :style="frameBoxStyle">
                    <iframe
                        :src="src"
                        :title="title"
                        sandbox="allow-scripts"
                        class="block bg-white"
                        :class="{ 'pointer-events-none': dragging }"
                        :style="frameStyle"
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
            <span class="text-sm text-muted tabular-nums">
                {{ t('Width') }}: {{ formatPixels(shownWidth) }}<template v-if="scale < 1"> · {{ formatPercent(scale) }}</template>
            </span>
            <OptionStrip v-model="preset" :items="screenOptions" :label="t('Screen size')" size="sm" />
        </template>
    </UModal>
    <!-- Mounted on first use so its overlay is placed after the window's and opens on top of it. -->
    <ChatFilePreview
        v-if="codeMounted"
        v-model:open="codeOpen"
        :url="fileUrl"
        :filename="filename"
        details="HTML"
        :preview="textFilePreview(filename)"
        :size="null"
    />
</template>
