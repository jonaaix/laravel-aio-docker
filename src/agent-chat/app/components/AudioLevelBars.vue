<script setup lang="ts">
defineProps<{ playing: boolean; label: string }>();

const DELAYS = ['-0.2s', '-0.9s', '-0.5s', '-1.2s'];
</script>

<template>
    <span class="flex h-3 shrink-0 items-end gap-0.5 px-0.5" role="img" :aria-label="label">
        <span
            v-for="delay in DELAYS"
            :key="delay"
            class="h-full w-0.5 origin-bottom rounded-full bg-primary"
            :class="playing ? 'motion-safe:animate-[audio-level_1.6s_ease-in-out_infinite]' : 'scale-y-40 opacity-60'"
            :style="{ animationDelay: delay }"
        />
    </span>
</template>
