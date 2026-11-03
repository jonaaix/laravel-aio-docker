<script setup lang="ts">
const { t } = useI18n();
const { usage } = useAccount();

const now = useNow();

const freeAt = computed(() => {
    const limited = [usage.value?.session, usage.value?.week].filter(window => window?.limited && window.resetsAt > now.value);
    return limited.length > 0 ? Math.max(...limited.map(window => window!.resetsAt)) : null;
});
</script>

<template>
    <div v-if="freeAt" class="flex items-center gap-3 rounded-md bg-warning/10 px-3.5 py-2.5 ring ring-warning/25">
        <UIcon name="i-heroicons-clock" class="size-5 shrink-0 text-warning" />
        <div class="min-w-0 flex-1 text-sm">
            <p class="font-semibold text-highlighted">{{ t('Usage limit reached') }}</p>
            <p class="text-toned">{{ t('Agents can answer again at {time}.', { time: formatClockTime(freeAt) }) }}</p>
        </div>
    </div>
</template>
