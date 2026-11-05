<script setup lang="ts">
defineProps<{
    src: string;
    title: string;
    height: number;
}>();
</script>

<template>
    <div class="relative w-full overflow-hidden bg-default" :style="{ height: `${height}px` }">
        <iframe
            :src="src"
            :title="title"
            sandbox="allow-scripts"
            loading="lazy"
            class="absolute inset-0 size-full"
        />
    </div>
</template>
