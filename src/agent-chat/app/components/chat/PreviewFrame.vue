<script setup lang="ts">
const props = defineProps<{
    src: string;
    title: string;
    width: number;
    height: number;
    scaled: boolean;
}>();

const box = ref<HTMLElement | null>(null);
const boxWidth = ref(0);
const scale = computed(() => {
    if (!props.scaled) {
        return 1;
    }
    return boxWidth.value > 0 ? Math.min(1, boxWidth.value / props.width) : 0;
});
const frameStyle = computed(() => (props.scaled
    ? { width: `${props.width}px`, height: `${props.height}px`, transform: `scale(${scale.value})` }
    : { width: '100%', height: `${props.height}px` }));

let observer: ResizeObserver | undefined;

onMounted(() => {
    observer = new ResizeObserver(([entry]) => {
        boxWidth.value = entry!.contentRect.width;
    });
    observer.observe(box.value!);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
    <!-- White in dark mode too: it stands in for the page, which is written for a white canvas. -->
    <div ref="box" class="relative w-full overflow-hidden bg-white" :style="{ height: `${height * scale}px` }">
        <iframe
            v-if="scale > 0"
            :src="src"
            :title="title"
            sandbox="allow-scripts"
            loading="lazy"
            class="absolute start-0 top-0 origin-top-left"
            :style="frameStyle"
        />
    </div>
</template>
