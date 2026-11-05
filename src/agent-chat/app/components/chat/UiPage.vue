<script setup lang="ts">
import type { UiPage } from '#shared/types/ui-block';

const props = defineProps<{
    page: UiPage;
    title: string | null;
}>();

const src = computed(() => apiUrl(props.page.url));
</script>

<template>
    <iframe
        :src="src"
        :title="title ?? undefined"
        sandbox="allow-scripts"
        loading="lazy"
        class="block w-full rounded-md bg-white ring ring-default"
        :style="{ height: `${page.height}px` }"
    />
</template>
