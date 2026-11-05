<script setup lang="ts">
import type { UiTimelineGroup, UiTimelineItem } from '#shared/types/ui-block';

const props = defineProps<{
    groups: UiTimelineGroup[];
}>();

function isScheduled(group: UiTimelineGroup): boolean {
    return group.items.some(item => item.start != null);
}

function lanesOf(group: UiTimelineGroup): { name: string; items: UiTimelineItem[] }[] {
    const names = [...new Set(group.items.flatMap(item => item.lane ? [item.lane] : []))];
    return names.map(name => ({ name, items: group.items.filter(item => item.lane === name) }));
}

function hasMarkers(items: UiTimelineItem[]): boolean {
    return items.some(item => item.marker);
}

const sequenceMarkers = computed(() => props.groups.some(group => !isScheduled(group) && lanesOf(group).length === 0 && hasMarkers(group.items)));
</script>

<template>
    <div class="grid gap-x-3" :class="sequenceMarkers ? 'grid-cols-[max-content_0.75rem_minmax(0,1fr)]' : 'grid-cols-[0.75rem_minmax(0,1fr)]'">
        <template v-for="(group, groupIndex) in groups" :key="groupIndex">
            <h3 v-if="group.heading" class="col-span-full font-semibold text-highlighted" :class="groupIndex > 0 ? 'mt-4 mb-2' : 'mb-2'">
                {{ group.heading }}
            </h3>
            <div v-else-if="groupIndex > 0" class="col-span-full h-4" />
            <ChatTimelineSchedule v-if="isScheduled(group)" :group="group" class="col-span-full" />
            <div v-else-if="lanesOf(group).length > 0" class="col-span-full scrollbar-slim overflow-x-auto">
                <div class="grid min-w-min auto-cols-[minmax(12rem,1fr)] grid-flow-col gap-4">
                    <section v-for="lane in lanesOf(group)" :key="lane.name" class="flex flex-col gap-2">
                        <p class="text-sm font-medium text-highlighted">
                            {{ lane.name }}
                        </p>
                        <ChatTimelineSequence :items="lane.items" :markers="hasMarkers(lane.items)" />
                    </section>
                </div>
            </div>
            <ChatTimelineSequence v-else :items="group.items" :markers="sequenceMarkers" subgrid />
        </template>
    </div>
</template>
