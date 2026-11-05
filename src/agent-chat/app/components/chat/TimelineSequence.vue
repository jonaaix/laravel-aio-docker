<script setup lang="ts">
import type { UiTimelineItem } from '#shared/types/ui-block';

defineProps<{
    items: UiTimelineItem[];
    markers: boolean;
    subgrid?: boolean;
}>();

const chatPlugins = useChatMarkdownPlugins();
</script>

<template>
    <div class="grid gap-x-3" :class="subgrid ? 'col-span-full grid-cols-subgrid' : markers ? 'grid-cols-[max-content_0.75rem_minmax(0,1fr)]' : 'grid-cols-[0.75rem_minmax(0,1fr)]'">
        <template v-for="(item, index) in items" :key="index">
            <span v-if="markers" class="text-end text-sm/6 text-muted tabular-nums">{{ item.marker }}</span>
            <span class="relative flex justify-center" aria-hidden="true">
                <span v-if="index < items.length - 1" class="absolute top-3 -bottom-3 w-px bg-accented" />
                <span class="relative mt-1.5 flex size-3 items-center justify-center">
                    <span v-if="item.state === 'active'" class="absolute inline-flex size-full rounded-full bg-primary opacity-75 motion-safe:animate-ping" />
                    <span class="relative inline-flex size-2.5 rounded-full" :class="timelineDotLook(item.state)" />
                </span>
            </span>
            <div class="flex min-w-0 flex-col gap-0.5" :class="{ 'pb-3': index < items.length - 1 }">
                <p class="font-medium text-highlighted">
                    {{ item.title }}
                </p>
                <Markdown v-if="item.text" :value="item.text" :plugins="chatPlugins" class="text-sm text-muted *:first:mt-0 *:last:mb-0" />
            </div>
        </template>
    </div>
</template>
