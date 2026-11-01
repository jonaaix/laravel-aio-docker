<script setup lang="ts">
const props = withDefaults(defineProps<{
    title: string;
    active: boolean;
    autoOpen: boolean;
    icon: string;
    iconClass?: string;
    expandable?: boolean;
}>(), { expandable: true });

const toggled = ref<boolean | null>(null);
watch(() => props.autoOpen, () => {
    toggled.value = null;
});

const open = computed({
    get: () => props.expandable && (toggled.value ?? props.autoOpen),
    set: (value: boolean) => {
        toggled.value = value;
    },
});
</script>

<template>
    <UCollapsible v-model:open="open" :disabled="!expandable" class="scrollbar-slim rounded-xl bg-elevated/40 ring ring-default">
        <button type="button" class="group flex w-full items-center gap-2 px-4 py-3 text-start text-sm">
            <UIcon v-if="active" name="i-heroicons-arrow-path" class="size-4 shrink-0 animate-spin text-muted" />
            <UIcon v-else :name="icon" class="size-4 shrink-0" :class="iconClass || 'text-muted'" />
            <UChatShimmer v-if="active" :text="title" class="font-medium" />
            <span v-else class="font-medium text-default">{{ title }}</span>
            <UIcon
                v-if="expandable"
                name="i-heroicons-chevron-down"
                class="ms-auto size-4 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
            />
        </button>

        <template #content>
            <div class="px-4 pb-4">
                <slot />
            </div>
        </template>
    </UCollapsible>
</template>
