<script setup lang="ts">
const props = withDefaults(defineProps<{
    title: string;
    active: boolean;
    autoOpen: boolean;
    icon: string;
    iconClass?: string;
    expandable?: boolean;
    alwaysOpen?: boolean;
    plain?: boolean;
}>(), { expandable: true, alwaysOpen: false, plain: false });

const toggled = ref<boolean | null>(null);
watch(() => props.autoOpen, () => {
    toggled.value = null;
});

const open = computed({
    get: () => props.alwaysOpen || (props.expandable && (toggled.value ?? props.autoOpen)),
    set: (value: boolean) => {
        toggled.value = value;
    },
});
</script>

<template>
    <UCollapsible v-model:open="open" :disabled="!expandable || alwaysOpen" class="scrollbar-slim" :class="plain ? '' : 'rounded-md bg-elevated/40 ring ring-default'">
        <button type="button" class="group flex items-center gap-2 text-start text-sm" :class="plain ? 'h-7 max-w-full' : 'h-9 w-full px-3'">
            <UIcon v-if="active" name="i-heroicons-arrow-path" class="size-4 shrink-0 animate-spin text-muted" />
            <UIcon v-else :name="icon" class="size-4 shrink-0" :class="iconClass || 'text-muted'" />
            <UChatShimmer v-if="active" :text="title" class="font-medium" />
            <span v-else class="font-medium text-default">{{ title }}</span>
            <UIcon
                v-if="expandable && !alwaysOpen"
                name="i-heroicons-chevron-down"
                class="size-4 shrink-0 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
                :class="plain ? '' : 'ms-auto'"
            />
        </button>

        <template #content>
            <div class="pb-2.5" :class="plain ? 'ps-2' : 'px-3'">
                <slot />
            </div>
        </template>
    </UCollapsible>
</template>
