<script setup lang="ts">
const props = defineProps<{
    title: string;
}>();

const tone = computed(() => markTone(props.title) ?? 'bg-elevated/60 dark:bg-elevated/40');
</script>

<template>
    <div class="my-3 rounded-lg px-4 py-3" :class="tone">
        <ChatSectionTitle :title="title" class="mb-1.5 font-semibold text-highlighted" />
        <slot />
    </div>
</template>
