<script setup>
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
    images: { type: Array, required: true },
    index: { type: Number, required: true },
    label: { type: Function, required: true },
    tone: { type: String, default: 'surface' },
});

const emit = defineEmits(['select']);
const strip = ref(null);

function reveal() {
    const button = strip.value?.children[props.index];

    if (!button) {
        return;
    }

    const left = button.offsetLeft - (strip.value.clientWidth - button.offsetWidth) / 2;
    strip.value.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
}

watch(() => props.index, () => nextTick(reveal), { immediate: true });
</script>

<template>
    <div ref="strip" class="ilg-thumbnails flex gap-1.5 overflow-x-auto scroll-smooth p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
            v-for="(image, position) in images"
            :key="image.src + position"
            type="button"
            :aria-label="label(position)"
            :aria-current="position === index ? 'true' : undefined"
            class="relative shrink-0 overflow-hidden rounded-md transition duration-200 ease-out focus-visible:outline-none"
            :class="[
                tone === 'overlay'
                    ? position === index ? 'opacity-100 ring-2 ring-white' : 'opacity-45 ring-1 ring-white/10 hover:opacity-80'
                    : position === index ? 'opacity-100 ring-2 ring-primary' : 'opacity-60 ring-1 ring-default hover:opacity-100',
                'focus-visible:ring-2 focus-visible:ring-primary',
            ]"
            @click="emit('select', position)"
        >
            <img :src="image.thumb ?? image.src" alt="" loading="lazy" draggable="false" class="aspect-[3/2] h-12 w-auto object-cover sm:h-14" />
        </button>
    </div>
</template>
