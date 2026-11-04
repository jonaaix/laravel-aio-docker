<script setup lang="ts">
defineProps<{
    title: string;
}>();
</script>

<template>
    <div class="my-3 rounded-lg bg-elevated/60 px-4 py-3 dark:bg-elevated/40">
        <ChatSectionTitle :title="title" class="mb-1.5 font-semibold text-highlighted" />
        <slot />
    </div>
</template>
