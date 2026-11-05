<script setup lang="ts">
const SIZE = 40;
const CENTER = SIZE / 2;
const BASE_RADIUS = 17.25;
const SWELL = 0.6;
const RIPPLE = 1.6;
const POINTS = 72;
const WAVES = [
    { count: 5, speed: 1.7, weight: 0.6 },
    { count: 8, speed: -2.3, weight: 0.4 },
];

const { level, echo, time } = useSpeechLevel();
const still = import.meta.client && matchMedia('(prefers-reduced-motion: reduce)').matches;

const path = computed(() => {
    const radiusBase = BASE_RADIUS + (still ? 0 : echo.value * SWELL);
    const ripple = still ? 0 : level.value * RIPPLE;
    const points = Array.from({ length: POINTS }, (_, index) => {
        const angle = (index / POINTS) * Math.PI * 2;
        const wobble = WAVES.reduce((sum, wave) => sum + Math.sin(angle * wave.count + time.value * wave.speed) * wave.weight, 0);
        const radius = radiusBase + ripple * wobble;
        return `${(CENTER + radius * Math.cos(angle)).toFixed(2)} ${(CENTER + radius * Math.sin(angle)).toFixed(2)}`;
    });
    return `M${points.join('L')}Z`;
});
</script>

<template>
    <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" class="pointer-events-none overflow-visible text-primary" aria-hidden="true">
        <path :d="path" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round" />
    </svg>
</template>
