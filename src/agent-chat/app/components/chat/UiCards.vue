<script setup lang="ts">
import type { UiCard, UiCardStatus } from '#shared/types/ui-block';

defineProps<{
    cards: UiCard[];
}>();

const chatPlugins = useChatMarkdownPlugins();

const STATUS_LOOK: Record<UiCardStatus, { surface: string; icon: string; tone: string }> = {
    good: { surface: 'bg-success/10 ring-success/30', icon: 'i-heroicons-check-circle', tone: 'text-success' },
    warning: { surface: 'bg-warning/10 ring-warning/30', icon: 'i-heroicons-exclamation-triangle', tone: 'text-warning' },
    bad: { surface: 'bg-error/10 ring-error/30', icon: 'i-heroicons-x-circle', tone: 'text-error' },
};
</script>

<template>
    <div class="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-2">
        <div
            v-for="(card, index) in cards"
            :key="index"
            class="flex flex-col gap-1 rounded-md p-3 ring"
            :class="card.status ? STATUS_LOOK[card.status].surface : 'ring-default'"
        >
            <p class="flex items-start gap-1.5 font-semibold text-highlighted">
                <UIcon v-if="card.status" :name="STATUS_LOOK[card.status].icon" class="mt-0.5 size-4 shrink-0" :class="STATUS_LOOK[card.status].tone" />
                {{ card.title }}
            </p>
            <Markdown v-if="card.text" :value="card.text" :plugins="chatPlugins" class="text-sm text-default *:first:mt-0 *:last:mb-0" />
        </div>
    </div>
</template>
