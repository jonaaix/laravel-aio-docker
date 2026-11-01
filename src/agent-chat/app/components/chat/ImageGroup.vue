<script setup lang="ts">
import type { FileUIPart } from 'ai';
import Gallery from '~/gallery/components/Gallery.vue';
import Lightbox from '~/gallery/components/Lightbox.vue';

const props = defineProps<{ parts: FileUIPart[] }>();

const images = computed(() => props.parts.map(part => ({
    src: apiUrl(part.url),
    caption: part.filename,
    alt: part.filename ?? '',
})));

const openIndex = ref<number | null>(null);
const preview = ref<HTMLImageElement | null>(null);
</script>

<template>
    <Gallery v-if="images.length > 1" :images="images" fit="contain" class="my-3" />
    <template v-else-if="images[0]">
        <button type="button" class="my-3 block w-fit cursor-zoom-in rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" aria-label="Open image" @click="openIndex = 0">
            <img ref="preview" :src="images[0].src" :alt="images[0].alt" class="max-h-96 rounded-xl ring ring-default">
        </button>
        <Lightbox :index="openIndex ?? undefined" :images="images" :thumbnails="false" :origin="() => preview?.getBoundingClientRect()" @update:index="openIndex = $event" @close="openIndex = null" />
    </template>
</template>
