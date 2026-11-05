<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
    <span class="flex shrink-0 items-center gap-0.75 px-0.5" role="status" :aria-label="label">
        <span
            v-for="dot in 3"
            :key="dot"
            class="size-1 rounded-full bg-primary motion-safe:animate-[typing-dot_1.8s_ease-in-out_infinite] motion-reduce:animate-[typing-fade_1.8s_ease-in-out_infinite]"
            :style="{ animationDelay: `${(dot - 1) * 0.2}s` }"
        />
    </span>
</template>
