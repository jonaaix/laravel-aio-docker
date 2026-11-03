<script setup lang="ts">
defineProps<{ state: SessionState }>();

const { t } = useI18n();
</script>

<template>
    <span class="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 text-[0.6875rem]/4 font-medium" :class="state.pillClass">
        <span class="relative flex size-1.5" aria-hidden="true">
            <span v-if="state.live" class="absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping" :class="state.dotClass" />
            <span class="relative inline-flex size-1.5 rounded-full" :class="state.dotClass" />
        </span>
        {{ t(state.label) }}
    </span>
</template>
