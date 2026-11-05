<script setup lang="ts">
const props = defineProps<{ playing: boolean; label: string }>();

const BANDS = [1, 4, 8, 13];
const WORD_SHAPES = [0.7, 1, 0.8, 0.55];
const REST = 0.25;
const GAIN = 1.2;
const CONTRAST = 1.8;
const WORD_SHARE = 0.6;

const { level, time } = useSpeechLevel();
const still = import.meta.client && matchMedia('(prefers-reduced-motion: reduce)').matches;

const heights = computed(() => {
    if (!props.playing || still) {
        return BANDS.map(() => REST);
    }
    void time.value;
    const spectrum = speechSpectrum();
    return BANDS.map((band, index) => {
        const value = Math.max((spectrum[band] ?? 0) ** CONTRAST, level.value * WORD_SHAPES[index]! * WORD_SHARE);
        return Math.min(1, REST + value * GAIN * (1 - REST));
    });
});
</script>

<template>
    <span class="flex h-3 shrink-0 items-end gap-0.5 px-0.5" role="img" :aria-label="label">
        <span
            v-for="(height, index) in heights"
            :key="index"
            class="h-full w-0.5 origin-bottom rounded-full bg-linear-to-t from-(--ai-gradient-from) via-(--ai-gradient-via) to-(--ai-gradient-to)"
            :class="playing ? '' : 'opacity-60'"
            :style="{ transform: `scaleY(${height})` }"
        />
    </span>
</template>
