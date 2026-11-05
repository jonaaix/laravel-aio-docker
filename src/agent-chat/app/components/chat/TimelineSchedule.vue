<script setup lang="ts">
import type { UiTimelineGroup } from '#shared/types/ui-block';
import type { ScheduleEntry } from '~/utils/timeline-schedule';

const props = defineProps<{
    group: UiTimelineGroup;
}>();

const EDGE_PX = 8;
const LANE_MIN_REM = 9;
const MINUTES_PER_DAY = 1440;

const chatPlugins = useChatMarkdownPlugins();

const expanded = ref<string | null>(null);
const expandedShift = ref(0);

function expandWhenClipped(key: string, event: MouseEvent): void {
    const card = event.currentTarget as HTMLElement;
    const entry = card.parentElement!;
    if (card.scrollHeight <= card.clientHeight + 1) {
        return;
    }
    const roomBelow = entry.parentElement!.clientHeight - entry.offsetTop - EDGE_PX;
    expandedShift.value = Math.min(Math.max(0, card.scrollHeight - roomBelow), entry.offsetTop);
    expanded.value = key;
}

const layout = computed(() => scheduleLayout(props.group));
const namedLanes = computed(() => layout.value.lanes.some(lane => lane.name));
const columns = computed(() => {
    const lanes = layout.value.lanes.map((lane) => {
        const width = Math.max(1, ...lane.entries.map(entry => entry.columns));
        return `minmax(${LANE_MIN_REM * width}rem, ${width}fr)`;
    });
    return [props.group.dated ? '6rem' : '3.25rem', ...lanes].join(' ');
});

function tickLabel(minute: number, index: number): string {
    if (props.group.dated && (index === 0 || minute % MINUTES_PER_DAY === 0)) {
        return formatPlanDay(minute);
    }
    return formatPlanTime(minute);
}

function entryStyle(entry: ScheduleEntry): Record<string, string> {
    return {
        top: `${entry.top + EDGE_PX}px`,
        height: `${entry.height}px`,
        left: `${(entry.column / entry.columns) * 100}%`,
        width: `${100 / entry.columns}%`,
    };
}

function span(entry: ScheduleEntry): string {
    return `${formatPlanTime(entry.item.start!)}–${formatPlanTime(entry.item.end!)}`;
}
</script>

<template>
    <div class="scrollbar-slim overflow-x-auto">
        <div class="grid min-w-min" :style="{ gridTemplateColumns: columns }">
            <template v-if="namedLanes">
                <div class="sticky start-0 z-10 bg-default" />
                <p v-for="(lane, index) in layout.lanes" :key="index" class="truncate px-1.5 pb-1 text-sm font-medium text-highlighted">
                    {{ lane.name }}
                </p>
            </template>
            <div class="sticky start-0 z-10 bg-default" :style="{ height: `${layout.height + EDGE_PX * 2}px` }">
                <span
                    v-for="(tick, index) in layout.ticks"
                    :key="tick.minute"
                    class="absolute end-2 -translate-y-1/2 text-xs text-muted tabular-nums"
                    :style="{ top: `${tick.top + EDGE_PX}px` }"
                >{{ tickLabel(tick.minute, index) }}</span>
            </div>
            <div v-for="(lane, laneIndex) in layout.lanes" :key="laneIndex" class="relative border-s border-default">
                <span
                    v-for="tick in layout.ticks"
                    :key="tick.minute"
                    class="absolute inset-x-0 border-t border-default/60"
                    :style="{ top: `${tick.top + EDGE_PX}px` }"
                    aria-hidden="true"
                />
                <div
                    v-for="(entry, index) in lane.entries"
                    :key="index"
                    class="absolute px-1"
                    :class="{ 'pb-1': !entry.point, 'z-[5]': expanded === `${laneIndex}-${index}` }"
                    :style="entryStyle(entry)"
                >
                    <div v-if="entry.point" class="flex h-full items-center gap-1.5 -translate-y-1/2">
                        <span class="relative flex size-3 shrink-0 items-center justify-center" aria-hidden="true">
                            <span v-if="entry.item.state === 'active'" class="absolute inline-flex size-full rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
                            <span class="relative inline-flex size-2.5 rounded-full" :class="timelineDotLook(entry.item.state)" />
                        </span>
                        <span class="min-w-0 truncate text-sm font-medium text-highlighted">{{ entry.item.title }}</span>
                    </div>
                    <div
                        v-else
                        class="relative flex min-h-full flex-col overflow-hidden rounded-sm px-2 py-1 ring ring-inset transition-[height,box-shadow,translate] duration-500 ease-out [interpolate-size:allow-keywords]"
                        :class="[timelineBlockLook(entry.item.state), expanded === `${laneIndex}-${index}` ? 'h-auto shadow-lg' : 'h-full']"
                        :style="expanded === `${laneIndex}-${index}` ? { translate: `0 -${expandedShift}px` } : undefined"
                        @mouseenter="expandWhenClipped(`${laneIndex}-${index}`, $event)"
                        @mouseleave="expanded = null"
                    >
                        <span v-if="entry.item.state === 'active'" class="absolute end-1.5 top-1.5 flex size-2" aria-hidden="true">
                            <span class="absolute inline-flex size-full rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
                            <span class="relative inline-flex size-2 rounded-full bg-primary" />
                        </span>
                        <p class="text-sm/5 font-medium text-highlighted">
                            {{ entry.item.title }}
                        </p>
                        <p class="text-xs text-muted tabular-nums">
                            {{ span(entry) }}
                        </p>
                        <Markdown v-if="entry.item.text" :value="entry.item.text" :plugins="chatPlugins" class="mt-0.5 text-xs/4 text-muted [&_*]:my-0 [&_*]:leading-4 [&_ol]:ps-4 [&_ul]:ps-3.5" />
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
