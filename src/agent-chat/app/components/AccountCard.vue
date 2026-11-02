<script setup lang="ts">
import type { UsageWindow } from '#shared/types/account';

const CLOCK_TICK_MS = 60_000;

const { profile, usage } = useAccount();

const now = ref(Date.now());
let clock: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
    clock = setInterval(() => {
        now.value = Date.now();
    }, CLOCK_TICK_MS);
});
onBeforeUnmount(() => clearInterval(clock));

function expired(limit: UsageWindow): boolean {
    return limit.resetsAt <= now.value;
}

const meters = computed(() => [
    { label: 'Session', limit: usage.value?.session ?? null },
    { label: 'Week', limit: usage.value?.week ?? null },
].filter((meter): meter is { label: string; limit: UsageWindow } => meter.limit !== null));

function meterColor(limit: UsageWindow): 'error' | 'warning' | 'neutral' {
    if (expired(limit)) {
        return 'neutral';
    }
    if (limit.limited || limit.utilization >= 0.9) {
        return 'error';
    }
    return limit.utilization >= 0.75 ? 'warning' : 'neutral';
}
</script>

<template>
    <div v-if="profile" class="w-full rounded-md bg-white p-3 ring ring-default dark:bg-default/60">
        <p class="truncate text-sm font-medium text-highlighted">{{ profile.email }}</p>
        <p v-if="profile.organization" class="truncate text-xs text-muted">{{ profile.organization }}</p>

        <div v-if="meters.length > 0" class="mt-2.5 flex flex-col gap-2">
            <div v-for="meter in meters" :key="meter.label" class="flex flex-col gap-1">
                <div class="flex items-baseline gap-2 text-xs">
                    <span :class="expired(meter.limit) ? 'text-muted' : 'text-default'">{{ meter.label }}</span>
                    <span class="min-w-0 flex-1 truncate text-end text-muted tabular-nums">
                        {{ expired(meter.limit) ? 'Reset since last update' : `Resets ${formatClockTime(meter.limit.resetsAt)}` }}
                    </span>
                    <span class="text-muted tabular-nums" :class="meter.limit.limited ? 'text-error' : ''">
                        {{ meter.limit.limited ? 'Limit reached' : formatPercent(meter.limit.utilization) }}
                    </span>
                </div>
                <UProgress :model-value="Math.round(meter.limit.utilization * 100)" :color="meterColor(meter.limit)" size="xs" :class="expired(meter.limit) ? 'opacity-50' : ''" />
            </div>
        </div>
        <p v-else class="mt-2.5 text-xs text-muted">No usage data yet</p>
    </div>
</template>
