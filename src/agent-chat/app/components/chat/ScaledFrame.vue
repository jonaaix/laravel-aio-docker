<script setup lang="ts">
const props = defineProps<{
    src: string;
    title: string;
    width: number;
    height: number;
}>();

const box = ref<HTMLElement | null>(null);
const boxWidth = ref(0);
const scale = computed(() => (boxWidth.value > 0 ? Math.min(1, boxWidth.value / props.width) : 0));

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
            tabindex="-1"
            class="pointer-events-none absolute start-0 top-0 origin-top-left"
            :style="{ width: `${width}px`, height: `${height}px`, transform: `scale(${scale})` }"
        />
    </div>
</template>
