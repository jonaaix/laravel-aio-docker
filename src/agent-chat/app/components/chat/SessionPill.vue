<script setup lang="ts">
defineProps<{ state: SessionState }>();

const { t } = useI18n();
</script>

<template>
    <UTooltip v-if="state.backgroundTasks > 0" :text="t(state.label)">
        <span class="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 text-[0.6875rem]/4 font-medium tabular-nums" :class="state.pillClass" role="status" :aria-label="t(state.label)">
            <UIcon name="i-heroicons-arrow-path" class="size-3 motion-safe:animate-[spin_2.4s_linear_infinite]" />
            {{ state.backgroundTasks }}
        </span>
    </UTooltip>
    <span v-else class="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 text-[0.6875rem]/4 font-medium" :class="state.pillClass">
        <span class="relative flex size-1.5" aria-hidden="true">
            <span v-if="state.live" class="absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping" :class="state.dotClass" />
            <span class="relative inline-flex size-1.5 rounded-full" :class="state.dotClass" />
        </span>
        {{ t(state.label) }}
    </span>
</template>
