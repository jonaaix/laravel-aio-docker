<script setup lang="ts">
import type { UiTimelineGroup, UiTimelineState } from '#shared/types/ui-block';

const props = defineProps<{
    groups: UiTimelineGroup[];
}>();

const chatPlugins = useChatMarkdownPlugins();

const hasMarkers = computed(() => props.groups.some(group => group.items.some(item => item.marker)));

const DOT_LOOK: Record<UiTimelineState | 'none', string> = {
    done: 'bg-primary',
    active: 'bg-primary shadow-[0_0_6px_1px_var(--ui-primary)]',
    open: 'bg-default ring-2 ring-inset ring-(--ui-text-dimmed)',
    none: 'bg-(--ui-text-dimmed)',
};
</script>

<template>
    <div class="grid gap-x-3" :class="hasMarkers ? 'grid-cols-[max-content_0.75rem_minmax(0,1fr)]' : 'grid-cols-[0.75rem_minmax(0,1fr)]'">
        <template v-for="(group, groupIndex) in groups" :key="groupIndex">
            <h3 v-if="group.heading" class="col-span-full font-semibold text-highlighted" :class="groupIndex > 0 ? 'mt-4 mb-2' : 'mb-2'">
                {{ group.heading }}
            </h3>
            <div v-else-if="groupIndex > 0" class="col-span-full h-4" />
            <template v-for="(item, index) in group.items" :key="`${groupIndex}-${index}`">
                <span v-if="hasMarkers" class="text-end text-sm/6 text-muted tabular-nums">{{ item.marker }}</span>
                <span class="relative flex justify-center" aria-hidden="true">
                    <span v-if="index < group.items.length - 1" class="absolute top-3 -bottom-3 w-px bg-accented" />
                    <span class="relative mt-1.5 flex size-3 items-center justify-center">
                        <span v-if="item.state === 'active'" class="absolute inline-flex size-full rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
                        <span class="relative inline-flex size-2.5 rounded-full" :class="DOT_LOOK[item.state ?? 'none']" />
                    </span>
                </span>
                <div class="flex min-w-0 flex-col gap-0.5" :class="{ 'pb-3': index < group.items.length - 1 }">
                    <p class="font-medium text-highlighted">
                        {{ item.title }}
                    </p>
                    <Markdown v-if="item.text" :value="item.text" :plugins="chatPlugins" class="text-sm text-muted *:first:mt-0 *:last:mb-0" />
                </div>
            </template>
        </template>
    </div>
</template>
