<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import { SPEECH_RATE_MENU } from '#shared/utils/speech';

defineProps<{ collapsed?: boolean }>();

const SEEK_DELAY_MS = 300;
const PROGRESS_STEPS = 1000;

const { t } = useI18n();
const { speechRate, setSpeechRate } = useAppearance();
const { speakingId, conversationId, label, paused, progress, chunkTexts, currentChunk, pause, resume, back, forward, seek, stop } = useSpeechPlayer();

const route = useRoute();
const readAlong = useReadAlong();
const draftProgress = ref<number | null>(null);
let seekTimer: ReturnType<typeof setTimeout> | undefined;

const rateItems = computed<DropdownMenuItem[]>(() => SPEECH_RATE_MENU.map(rate => ({
    label: formatSpeedFactor(rate),
    type: 'checkbox',
    checked: rate === speechRate.value,
    onSelect: () => void setSpeechRate(rate),
})));
const shownProgress = computed(() => draftProgress.value ?? Math.round(progress.value * PROGRESS_STEPS));

function moveProgress(value: number | undefined): void {
    if (value === undefined) {
        return;
    }
    draftProgress.value = value;
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => {
        seek(value / PROGRESS_STEPS);
        draftProgress.value = null;
    }, SEEK_DELAY_MS);
}

async function revealCurrentRate(open: boolean): Promise<void> {
    if (!open) {
        return;
    }
    await nextTick();
    document.querySelector('[role="menuitemcheckbox"][aria-checked="true"]')?.scrollIntoView({ block: 'center' });
}

function openReading(): void {
    if (route.params.id === conversationId.value) {
        readAlong.reveal();
    }
    else {
        readAlong.requestReveal();
    }
}

function togglePause(): void {
    if (paused.value) {
        resume();
    }
    else {
        pause();
    }
}
</script>

<template>
    <UTooltip v-if="speakingId && collapsed" :text="paused ? t('Resume') : t('Pause')">
        <UButton color="neutral" variant="ghost" square :aria-label="paused ? t('Resume') : t('Pause')" class="size-9 justify-center self-center rounded-full hover:bg-primary/10" @click="togglePause">
            <UIcon v-if="paused" name="i-heroicons-play" class="size-5" />
            <AudioLevelBars v-else :playing="true" :label="t('Reading aloud')" />
        </UButton>
    </UTooltip>
    <div v-else-if="speakingId" class="flex flex-col gap-2 rounded-md bg-default p-3 ring ring-default dark:bg-default/60">
        <div class="flex min-w-0 items-center gap-2">
            <AudioLevelBars :playing="!paused" :label="paused ? t('Paused') : t('Reading aloud')" />
            <NuxtLink v-if="conversationId" :to="`/c/${conversationId}`" class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted hover:underline" @click="openReading">{{ label }}</NuxtLink>
            <span v-else class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ label }}</span>
            <UTooltip :text="t('Stop reading')">
                <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="xs" :aria-label="t('Stop reading')" @click="stop" />
            </UTooltip>
        </div>
        <USlider
            :model-value="shownProgress"
            :min="0"
            :max="PROGRESS_STEPS"
            size="xs"
            class="group"
            :ui="{ track: 'h-1', thumb: 'size-3 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100' }"
            :aria-label="t('Reading position')"
            @update:model-value="moveProgress"
        />
        <div class="grid grid-cols-[1fr_auto_1fr] items-center">
            <span class="self-end text-[0.625rem]/none font-semibold text-muted tabular-nums" :aria-label="t('Reading position')">{{ currentChunk + 1 }}/{{ chunkTexts.length }}</span>
            <div class="flex items-center gap-1">
                <UTooltip :text="t('Back 10 seconds')">
                    <UButton trailing-icon="i-heroicons-arrow-uturn-left" label="10s" color="neutral" variant="ghost" size="sm" class="items-end gap-0.5 text-[0.625rem]/none font-semibold tabular-nums" :aria-label="t('Back 10 seconds')" @click="back" />
                </UTooltip>
                <UTooltip :text="paused ? t('Resume') : t('Pause')">
                    <UButton :icon="paused ? 'i-heroicons-play' : 'i-heroicons-pause'" color="primary" variant="solid" size="sm" square class="rounded-full" :aria-label="paused ? t('Resume') : t('Pause')" @click="togglePause" />
                </UTooltip>
                <UTooltip :text="t('Forward 10 seconds')">
                    <UButton icon="i-heroicons-arrow-uturn-right" label="10s" color="neutral" variant="ghost" size="sm" class="items-end gap-0.5 text-[0.625rem]/none font-semibold tabular-nums" :aria-label="t('Forward 10 seconds')" @click="forward" />
                </UTooltip>
            </div>
            <UDropdownMenu :items="rateItems" @update:open="revealCurrentRate" :content="{ side: 'top', align: 'end' }" :ui="{ content: 'max-h-56 overflow-y-auto scrollbar-slim', itemLabel: 'tabular-nums' }">
                <UButton :label="formatSpeedFactor(speechRate)" color="neutral" variant="ghost" size="sm" class="-me-1.5 h-auto self-end justify-self-end px-1.5 py-0.5 text-[0.625rem]/none font-semibold tabular-nums" :aria-label="t('Reading speed')" />
            </UDropdownMenu>
        </div>
    </div>
</template>
