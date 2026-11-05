<script setup lang="ts">
defineProps<{ state: SessionState }>();

const { t } = useI18n();
</script>

<template>
    <span class="inline-flex shrink-0 items-center gap-1">
        <UTooltip v-if="state.backgroundTasks > 0" :text="t('Running in the background')">
            <span class="inline-flex items-center gap-1 rounded-md bg-info/10 px-1.5 text-[0.6875rem]/4 font-medium text-info tabular-nums" role="status" :aria-label="t('Running in the background')">
                <UIcon name="i-heroicons-arrow-path" class="size-3 motion-safe:animate-[spin_2.4s_linear_infinite]" />
                {{ state.backgroundTasks }}
            </span>
        </UTooltip>
        <span class="inline-flex items-center gap-1 rounded-md px-1.5 text-[0.6875rem]/4 font-medium" :class="state.pillClass">
            <span class="relative flex size-1.5" aria-hidden="true">
                <span v-if="state.live" class="absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping" :class="state.dotClass" />
                <span class="relative inline-flex size-1.5 rounded-full" :class="state.dotClass" />
            </span>
            {{ t(state.label) }}
        </span>
    </span>
</template>
