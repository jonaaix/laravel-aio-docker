<script setup lang="ts">
defineProps<{
    title: string;
}>();
</script>

<template>
    <div class="my-4 rounded-xl bg-white ring ring-default dark:bg-elevated/40">
        <div class="flex h-11 items-center border-b border-default px-3 font-semibold text-highlighted">
            <ChatSectionTitle :title="title" />
        </div>
        <div class="p-4">
            <slot />
        </div>
    </div>
</template>
