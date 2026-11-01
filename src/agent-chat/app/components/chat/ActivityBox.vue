<script setup lang="ts" generic="T">
const props = withDefaults(defineProps<{
    title: string;
    active: boolean;
    icon: string;
    iconClass?: string;
    items: T[];
    itemKey: (item: T, index: number) => string;
    earlierLabel: (count: number) => string;
    fewerLabel: string;
    limit?: number;
}>(), { iconClass: '', limit: 5 });

defineSlots<{ item(props: { item: T; index: number }): unknown }>();

const showAll = ref(false);
const hiddenCount = computed(() => showAll.value ? 0 : Math.max(0, props.items.length - props.limit));
const visibleItems = computed(() => props.items.slice(hiddenCount.value).map((item, offset) => ({ item, index: hiddenCount.value + offset })));
</script>

<template>
    <div class="mb-3 rounded-xl bg-elevated/40 p-3 ring ring-default">
        <div class="flex h-6 items-center gap-2 text-sm">
            <UIcon v-if="active" name="i-heroicons-arrow-path" class="size-4 shrink-0 animate-spin text-muted" />
            <UIcon v-else :name="icon" class="size-4 shrink-0 text-muted" :class="iconClass" />
            <UChatShimmer v-if="active" :text="title" class="font-medium" />
            <span v-else class="font-medium text-default">{{ title }}</span>
        </div>

        <div v-if="items.length > 0" class="mt-1 flex flex-col gap-1">
            <UButton
                v-if="items.length > limit"
                :label="showAll ? fewerLabel : earlierLabel(hiddenCount)"
                :icon="showAll ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-up'"
                color="neutral"
                variant="link"
                size="xs"
                class="self-start px-0"
                @click="showAll = !showAll"
            />
            <template v-for="entry in visibleItems" :key="itemKey(entry.item, entry.index)">
                <slot name="item" :item="entry.item" :index="entry.index" />
            </template>
        </div>
    </div>
</template>
