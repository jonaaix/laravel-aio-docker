<script setup lang="ts">
import type { OptionStripItem } from '~/components/OptionStrip.vue';

defineProps<{
    src: string;
    fileUrl: string;
    filename: string;
    createdAt: number;
    title: string;
}>();

const open = defineModel<boolean>('open', { required: true });

const { t } = useI18n();

const MIN_WIDTH = 320;

type ScreenPreset = 'window' | 'iphone' | 'macbook' | 'monitor-24' | 'monitor-27';

interface ScreenSize {
    width: number;
    height: number;
}

const SCREENS: Record<Exclude<ScreenPreset, 'window'>, ScreenSize> = {
    'iphone': { width: 402, height: 874 },
    'macbook': { width: 1470, height: 956 },
    'monitor-24': { width: 1920, height: 1080 },
    'monitor-27': { width: 2560, height: 1440 },
};

const screenOptions = computed<OptionStripItem<ScreenPreset>[]>(() => [
    { value: 'window', label: t('Window'), icon: 'i-heroicons-window' },
    { value: 'iphone', label: t('Phone'), icon: 'i-heroicons-device-phone-mobile' },
    { value: 'macbook', label: '13″', icon: 'i-heroicons-computer-desktop' },
    { value: 'monitor-24', label: '24″', icon: 'i-heroicons-computer-desktop' },
    { value: 'monitor-27', label: '27″', icon: 'i-heroicons-computer-desktop' },
]);

const stage = ref<HTMLElement | null>(null);
const stageSize = reactive({ width: 0, height: 0 });
const frameWidth = ref<number | null>(null);
const frameHeight = ref<number | null>(null);
const dragging = ref(false);
const codeOpen = ref(false);
const codeMounted = ref(false);
const frameReady = ref(false);

const shownWidth = computed(() => frameWidth.value ?? stageSize.width);
const shownHeight = computed(() => frameHeight.value ?? stageSize.height);
const scale = computed(() => {
    if (stageSize.width <= 0 || stageSize.height <= 0) {
        return 1;
    }
    return Math.min(1, stageSize.width / shownWidth.value, frameHeight.value === null ? 1 : stageSize.height / frameHeight.value);
});
const preset = computed<ScreenPreset | ''>({
    get: () => {
        if (frameWidth.value === null && frameHeight.value === null) {
            return 'window';
        }
        return (Object.entries(SCREENS).find(([, screen]) => screen.width === frameWidth.value && screen.height === frameHeight.value)?.[0] as ScreenPreset | undefined) ?? '';
    },
    set: (value) => {
        if (value === 'window') {
            resetSize();
        }
        else if (value) {
            frameWidth.value = SCREENS[value].width;
            frameHeight.value = SCREENS[value].height;
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
        resetSize();
    }
});

onBeforeUnmount(() => observer?.disconnect());

function startResize(event: PointerEvent): void {
    const startX = event.clientX;
    const startWidth = shownWidth.value * scale.value;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    dragging.value = true;
    frameHeight.value = null;
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

function focusWindow(event: Event): void {
    event.preventDefault();
    (event.currentTarget as HTMLElement | null)?.focus();
}

function showCode(): void {
    codeMounted.value = true;
    codeOpen.value = true;
}

function resetSize(): void {
    frameWidth.value = null;
    frameHeight.value = null;
}

const frameBoxStyle = computed(() => ({
    width: frameWidth.value === null ? '100%' : `${shownWidth.value * scale.value}px`,
    height: frameHeight.value === null ? '100%' : `${frameHeight.value * scale.value}px`,
}));
const frameStyle = computed(() => {
    if (scale.value === 1 && frameHeight.value === null) {
        return { width: '100%', height: '100%' };
    }
    const height = frameHeight.value ?? stageSize.height / scale.value;
    return { width: `${shownWidth.value}px`, height: `${height}px`, transform: `scale(${scale.value})`, transformOrigin: 'top left' };
});
</script>

<template>
    <UModal
        v-model:open="open"
        :title="title"
        :content="{ onOpenAutoFocus: focusWindow }"
        @after:enter="frameReady = true"
        @after:leave="frameReady = false"
        :ui="{ content: 'w-[min(96vw,1600px)] max-w-none h-[calc(100vh-1rem)] max-h-none sm:max-h-none max-sm:h-dvh max-sm:w-screen max-sm:rounded-none max-sm:ring-0', body: 'flex flex-1 p-0 sm:p-0 overflow-hidden', footer: 'justify-between' }"
    >
        <template #actions>
            <UTooltip :text="t('View code')">
                <UButton icon="i-heroicons-code-bracket" color="neutral" variant="ghost" class="size-7 justify-center p-0" :aria-label="t('View code')" @click="showCode" />
            </UTooltip>
            <UTooltip :text="t('Download')">
                <UButton icon="i-heroicons-arrow-down-tray" color="neutral" variant="ghost" class="size-7 justify-center p-0" :aria-label="t('Download')" @click="downloadFile(fileUrl, withTimestamp(filename, new Date(createdAt)))" />
            </UTooltip>
            <UTooltip :text="t('Open in new tab')">
                <UButton icon="i-heroicons-arrow-top-right-on-square" color="neutral" variant="ghost" class="size-7 justify-center p-0" :aria-label="t('Open in new tab')" :to="src" target="_blank" external />
            </UTooltip>
        </template>
        <template #body>
            <div ref="stage" class="flex flex-1 items-center justify-center overflow-hidden bg-muted sm:px-4" :class="{ 'py-4': frameHeight !== null }">
                <!-- White in dark mode too: it stands in for the page, which is written for a white canvas. -->
                <div class="relative bg-white" :style="frameBoxStyle">
                    <iframe
                        v-if="frameReady"
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
                        class="group absolute inset-y-0 -end-3 flex w-3 cursor-ew-resize touch-none items-center justify-center max-sm:hidden"
                        @pointerdown.prevent="startResize"
                        @dblclick="resetSize"
                    >
                        <span class="h-10 w-1 rounded-full bg-accented transition-colors duration-500 ease-out group-hover:bg-primary" :class="{ 'bg-primary': dragging }" />
                    </div>
                </div>
            </div>
        </template>
        <template #footer>
            <span class="text-sm text-muted tabular-nums">
                {{ formatScreenSize(shownWidth, shownHeight) }}<template v-if="scale < 1"> · {{ formatPercent(scale) }}</template>
            </span>
            <OptionStrip v-model="preset" :items="screenOptions" :label="t('Screen size')" size="sm" class="max-sm:hidden" />
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
