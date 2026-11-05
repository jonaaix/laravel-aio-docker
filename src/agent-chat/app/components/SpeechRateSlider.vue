<script setup lang="ts">
import { MAX_SPEECH_RATE, MIN_SPEECH_RATE, SPEECH_RATE_STEP } from '#shared/utils/speech';

defineProps<{ label: string }>();

const SAVE_DELAY_MS = 400;

const { speechRate, setSpeechRate } = useAppearance();
const draft = ref<number | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

const shown = computed(() => draft.value ?? speechRate.value);

function snap(rate: number): number {
    return Number((Math.round(rate / SPEECH_RATE_STEP) * SPEECH_RATE_STEP).toFixed(2));
}

async function save(rate: number): Promise<void> {
    try {
        await setSpeechRate(rate);
    }
    finally {
        if (draft.value === rate) {
            draft.value = null;
        }
    }
}

function move(rate: number | undefined): void {
    if (rate === undefined) {
        return;
    }
    const snapped = snap(rate);
    draft.value = snapped;
    clearTimeout(timer);
    timer = setTimeout(() => void save(snapped), SAVE_DELAY_MS);
}
</script>

<template>
    <div class="flex h-9 items-center gap-4">
        <USlider
            :model-value="shown"
            :min="MIN_SPEECH_RATE"
            :max="MAX_SPEECH_RATE"
            :step="SPEECH_RATE_STEP"
            :aria-label="label"
            class="flex-1"
            @update:model-value="move"
        />
        <span class="w-12 text-end text-sm font-medium tabular-nums">{{ formatSpeedFactor(snap(shown)) }}</span>
    </div>
</template>
