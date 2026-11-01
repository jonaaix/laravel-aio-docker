<script setup lang="ts">
defineProps<{
    title: string;
    active: boolean;
    icon: string;
    iconClass?: string;
}>();
</script>

<template>
    <div class="scrollbar-slim rounded-xl bg-elevated/40 p-3 ring ring-default">
        <div class="flex h-6 items-center gap-2 text-sm">
            <UIcon v-if="active" name="i-heroicons-arrow-path" class="size-4 shrink-0 animate-spin text-muted" />
            <UIcon v-else :name="icon" class="size-4 shrink-0" :class="iconClass || 'text-muted'" />
            <UChatShimmer v-if="active" :text="title" class="font-medium" />
            <span v-else class="font-medium text-default">{{ title }}</span>
        </div>
        <slot />
    </div>
</template>
