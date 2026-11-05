<script setup lang="ts">
import type { UiCardSection, UiCardStatus } from '#shared/types/ui-block';

defineProps<{
    sections: UiCardSection[];
}>();

const chatPlugins = useChatMarkdownPlugins();

const STATUS_LOOK: Record<UiCardStatus, { surface: string; icon: string; tone: string }> = {
    good: { surface: 'bg-success/10 ring-success/30', icon: 'i-heroicons-check-circle', tone: 'text-success' },
    warning: { surface: 'bg-warning/10 ring-warning/30', icon: 'i-heroicons-exclamation-triangle', tone: 'text-warning' },
    bad: { surface: 'bg-error/10 ring-error/30', icon: 'i-heroicons-x-circle', tone: 'text-error' },
};
</script>

<template>
    <div class="flex flex-col gap-4">
        <section v-for="(section, sectionIndex) in sections" :key="sectionIndex" class="flex flex-col gap-2">
            <h3 class="flex items-center gap-1.5 font-semibold text-highlighted">
                <UIcon v-if="section.status" :name="STATUS_LOOK[section.status].icon" class="size-4 shrink-0" :class="STATUS_LOOK[section.status].tone" />
                {{ section.heading }}
            </h3>
            <div class="grid gap-2 sm:grid-cols-2">
                <div
                    v-for="(card, index) in section.cards"
                    :key="index"
                    class="flex flex-col gap-1 rounded-md p-3 ring"
                    :class="[section.status ? STATUS_LOOK[section.status].surface : 'ring-default', { 'sm:col-span-2': card.wide }]"
                >
                    <p class="font-semibold text-highlighted">
                        {{ card.title }}
                    </p>
                    <Markdown v-if="card.text" :value="card.text" :plugins="chatPlugins" class="text-sm text-default *:first:mt-0 *:last:mb-0" />
                </div>
            </div>
        </section>
    </div>
</template>
