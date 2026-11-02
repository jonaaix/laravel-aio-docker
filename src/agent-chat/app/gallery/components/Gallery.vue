<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { SLIDE_DURATION, SLIDE_EASING, useSlider } from '../composables/useSlider.js';
import { DEFAULT_LABELS, format } from '../labels.js';
import IconChevronLeft from '../icons/IconChevronLeft.vue';
import IconChevronRight from '../icons/IconChevronRight.vue';
import IconFullscreen from '../icons/IconFullscreen.vue';
import IconButton from './IconButton.vue';
import Lightbox from './Lightbox.vue';
import Thumbnails from './Thumbnails.vue';

const props = defineProps({
    images: { type: Array, required: true },
    start: { type: Number, default: 0 },
    aspect: { type: String, default: '3 / 2' },
    fit: { type: String, default: 'cover' },
    loop: { type: Boolean, default: true },
    thumbnails: { type: Boolean, default: true },
    lightbox: { type: Boolean, default: true },
    labels: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['change']);

const text = computed(() => ({ ...DEFAULT_LABELS, ...props.labels }));
const stage = ref(null);
const track = ref(null);
const width = ref(0);
const lightboxIndex = ref(null);

const slider = useSlider({
    count: () => props.images.length,
    loop: () => props.loop,
    width: () => width.value,
    start: props.start,
});

const slides = computed(() => [
    { position: -1, image: slider.prevIndex.value === null ? null : props.images[slider.prevIndex.value] },
    { position: 0, image: props.images[slider.index.value] ?? null },
    { position: 1, image: slider.nextIndex.value === null ? null : props.images[slider.nextIndex.value] },
]);

const trackStyle = computed(() => ({
    transform: `translate3d(${slider.offset.value}px, 0, 0)`,
    transition: slider.animating.value ? `transform ${SLIDE_DURATION}ms ${SLIDE_EASING}` : 'none',
}));

watch(slider.index, (index) => emit('change', index));
watch(() => props.images, () => slider.reset(0));

let resizeObserver = null;

onMounted(() => {
    width.value = stage.value?.clientWidth ?? 0;
    resizeObserver = new ResizeObserver(([entry]) => (width.value = entry.contentRect.width));
    resizeObserver.observe(stage.value);
});

onBeforeUnmount(() => resizeObserver?.disconnect());

let drag = null;

function onPointerDown(event) {
    if (event.button !== 0 || props.images.length === 0) {
        return;
    }

    const base = slider.animating.value ? slider.interrupt(new DOMMatrix(getComputedStyle(track.value).transform).m41) : 0;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, base, lastX: event.clientX, lastTime: performance.now(), velocity: 0, axis: base !== 0 ? 'x' : null };

    if (base !== 0) {
        stage.value.setPointerCapture(event.pointerId);
    }
}

function onPointerMove(event) {
    if (!drag || drag.id !== event.pointerId) {
        return;
    }

    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;

    if (!drag.axis && Math.hypot(dx, dy) > 8) {
        drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';

        if (drag.axis === 'x') {
            stage.value.setPointerCapture(event.pointerId);
        }
    }

    if (drag.axis !== 'x') {
        return;
    }

    const now = performance.now();
    drag.velocity = (event.clientX - drag.lastX) / Math.max(1, now - drag.lastTime);
    drag.lastX = event.clientX;
    drag.lastTime = now;
    slider.drag(drag.base + dx);
}

function onPointerUp(event) {
    if (!drag || drag.id !== event.pointerId) {
        return;
    }

    if (drag.axis === 'x') {
        slider.release(drag.base + event.clientX - drag.x, drag.velocity);
    } else if (!drag.axis && props.lightbox) {
        lightboxIndex.value = slider.index.value;
    }

    drag = null;
}

function originOf() {
    return stage.value?.getBoundingClientRect() ?? null;
}

function onLightboxChange(index) {
    lightboxIndex.value = index;
    slider.reset(index);
}
</script>

<template>
    <div v-if="images.length" class="ilg-gallery space-y-2">
        <div
            ref="stage"
            class="group relative overflow-hidden rounded-md bg-elevated ring-1 ring-default"
            :class="lightbox ? 'cursor-zoom-in' : ''"
            :style="{ aspectRatio: aspect }"
            style="touch-action: pan-y"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointercancel="onPointerUp"
        >
            <div ref="track" class="absolute inset-0" :style="trackStyle">
                <div
                    v-for="slide in slides"
                    :key="slide.position"
                    class="absolute inset-0"
                    :style="{ transform: `translate3d(${slide.position * 100}%, 0, 0)` }"
                >
                    <img
                        v-if="slide.image"
                        :key="slide.image.src"
                        :src="slide.image.src"
                        :alt="slide.position === 0 ? (slide.image.alt ?? slide.image.caption ?? '') : ''"
                        draggable="false"
                        class="size-full select-none"
                        :class="fit === 'contain' ? 'object-contain' : 'object-cover'"
                    />
                </div>
            </div>

            <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100" />

            <template v-if="images.length > 1">
                <div v-if="slider.prevIndex.value !== null" class="absolute left-2 top-1/2 -translate-y-1/2">
                    <IconButton :label="text.previous" tone="plain" size="md" class="ilg-inline-arrow" @pointerdown.stop @click="slider.step(-1)">
                        <IconChevronLeft />
                    </IconButton>
                </div>
                <div v-if="slider.nextIndex.value !== null" class="absolute right-2 top-1/2 -translate-y-1/2">
                    <IconButton :label="text.next" tone="plain" size="md" class="ilg-inline-arrow" @pointerdown.stop @click="slider.step(1)">
                        <IconChevronRight />
                    </IconButton>
                </div>
            </template>

            <span
                v-if="images.length > 1"
                class="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium tabular-nums text-white backdrop-blur-sm"
            >
                {{ format(text.counter, { current: slider.target.value + 1, total: images.length }) }}
            </span>

            <div v-if="lightbox" class="absolute right-2 top-2">
                <IconButton :label="text.open" tone="plain" size="md" class="ilg-inline-open" @pointerdown.stop @click="lightboxIndex = slider.index.value">
                    <IconFullscreen />
                </IconButton>
            </div>
        </div>

        <Thumbnails
            v-if="thumbnails && images.length > 1"
            :images="images"
            :index="slider.target.value"
            :label="(position) => format(text.image, { number: position + 1 })"
            @select="slider.goTo"
        />

        <Lightbox
            v-if="lightbox"
            :images="images"
            :index="lightboxIndex"
            :origin="originOf"
            :loop="loop"
            :labels="labels"
            @update:index="onLightboxChange"
            @close="lightboxIndex = null"
        />
    </div>
</template>

<style>
.ilg-inline-arrow,
.ilg-inline-open {
    background-color: rgb(0 0 0 / 0.28);
    color: rgb(255 255 255 / 0.92);
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.14);
    backdrop-filter: blur(6px);
    opacity: 0;
    transition: opacity 500ms ease-out, background-color 150ms ease-out;
}

.group:hover .ilg-inline-arrow,
.group:hover .ilg-inline-open,
.ilg-inline-arrow:focus-visible,
.ilg-inline-open:focus-visible {
    opacity: 1;
}

.ilg-inline-arrow:hover,
.ilg-inline-open:hover {
    background-color: rgb(0 0 0 / 0.45);
}

@media (hover: none) {
    .ilg-inline-arrow {
        display: none;
    }

    .ilg-inline-open {
        opacity: 1;
    }
}
</style>
