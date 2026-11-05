<script setup lang="ts">
import type { UsageSnapshot, UsageWindow } from '#shared/types/account';

const props = defineProps<{ usage?: UsageSnapshot | null }>();

const { t } = useI18n();
const { usage: activeUsage } = useAccount();
const usage = computed(() => props.usage === undefined ? activeUsage.value : props.usage);

const now = useNow();

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
    <div v-if="meters.length > 0" class="flex flex-col gap-2">
        <div v-for="meter in meters" :key="meter.label" class="flex flex-col gap-1">
            <div class="flex items-baseline gap-2 text-xs">
                <span :class="expired(meter.limit) ? 'text-muted' : 'text-default'">{{ t(meter.label) }}</span>
                <span class="min-w-0 flex-1 truncate text-end text-muted tabular-nums">
                    {{ expired(meter.limit) ? t('Reset since last update') : t('Resets {time}', { time: formatClockTime(meter.limit.resetsAt) }) }}
                </span>
                <span class="text-muted tabular-nums" :class="meter.limit.limited ? 'text-error' : ''">
                    {{ formatPercent(meter.limit.utilization) }}
                </span>
            </div>
            <UProgress :model-value="Math.round(meter.limit.utilization * 100)" :color="meterColor(meter.limit)" size="xs" :class="expired(meter.limit) ? 'opacity-50' : ''" />
        </div>
    </div>
    <p v-else class="text-xs text-muted">{{ t('No usage data yet') }}</p>
</template>
