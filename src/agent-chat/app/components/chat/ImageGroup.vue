<script setup lang="ts">
import type { FileUIPart } from 'ai';
import Gallery from '~/gallery/components/Gallery.vue';
import Lightbox from '~/gallery/components/Lightbox.vue';

const props = defineProps<{ parts: FileUIPart[] }>();

const { t } = useI18n();

function captionOf(part: FileUIPart): string | undefined {
    const caption = part.providerMetadata?.agentChat?.caption;
    return typeof caption === 'string' && caption.trim() ? caption.trim() : undefined;
}

const images = computed(() => props.parts.map(part => ({
    src: apiUrl(part.url),
    caption: captionOf(part) ?? part.filename,
    alt: captionOf(part) ?? part.filename ?? '',
})));

const captioned = computed(() => props.parts.some(part => captionOf(part) !== undefined));

const openIndex = ref<number | null>(null);
const preview = ref<HTMLImageElement | null>(null);
</script>

<template>
    <Gallery v-if="images.length > 1" :images="images" :captions="captioned" fit="contain" class="my-3" />
    <figure v-else-if="images[0]" class="my-3 flex w-fit flex-col gap-2">
        <button type="button" class="block w-fit cursor-zoom-in rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" :aria-label="t('Open image')" @click="openIndex = 0">
            <img ref="preview" :src="images[0].src" :alt="images[0].alt" class="max-h-96 rounded-md ring ring-default">
        </button>
        <figcaption v-if="captioned" class="text-sm text-muted">{{ images[0].caption }}</figcaption>
        <Lightbox :index="openIndex ?? undefined" :images="images" :thumbnails="false" :origin="() => preview?.getBoundingClientRect()" @update:index="openIndex = $event" @close="openIndex = null" />
    </figure>
</template>
