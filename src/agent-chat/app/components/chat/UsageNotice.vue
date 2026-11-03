<script setup lang="ts">
const CLOCK_TICK_MS = 60_000;

const { usage } = useAccount();

const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
    clock = setInterval(() => {
        now.value = Date.now();
    }, CLOCK_TICK_MS);
});
onBeforeUnmount(() => clearInterval(clock));

const freeAt = computed(() => {
    const limited = [usage.value?.session, usage.value?.week].filter(window => window?.limited && window.resetsAt > now.value);
    return limited.length > 0 ? Math.max(...limited.map(window => window!.resetsAt)) : null;
});
</script>

<template>
    <div v-if="freeAt" class="flex items-center gap-3 rounded-md bg-warning/10 px-3.5 py-2.5 ring ring-warning/25">
        <UIcon name="i-heroicons-clock" class="size-5 shrink-0 text-warning" />
        <div class="min-w-0 flex-1 text-sm">
            <p class="font-semibold text-highlighted">Usage limit reached</p>
            <p class="text-toned">Agents can answer again at {{ formatClockTime(freeAt) }}.</p>
        </div>
    </div>
</template>
