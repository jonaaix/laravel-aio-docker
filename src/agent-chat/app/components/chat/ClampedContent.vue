<script setup lang="ts">
const COLLAPSE_FROM_LINES = 25;
const VISIBLE_LINES = 15;

const content = ref<HTMLElement | null>(null);
const lineHeight = ref(0);
const fullHeight = ref(0);
const expanded = ref(false);

const { t } = useI18n();

const collapsible = computed(() => lineHeight.value > 0 && fullHeight.value > lineHeight.value * COLLAPSE_FROM_LINES);
const collapsed = computed(() => collapsible.value && !expanded.value);

function measure(): void {
    if (!content.value) {
        return;
    }
    const style = getComputedStyle(content.value);
    const declared = Number.parseFloat(style.lineHeight);
    lineHeight.value = Number.isNaN(declared) ? Number.parseFloat(style.fontSize) * 1.5 : declared;
    fullHeight.value = content.value.scrollHeight;
}

let observer: ResizeObserver | undefined;

onMounted(() => {
    observer = new ResizeObserver(measure);
    observer.observe(content.value!);
    measure();
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
    <div>
        <div
            ref="content"
            :class="collapsed ? 'overflow-hidden mask-b-from-50%' : ''"
            :style="collapsed ? { maxHeight: `${lineHeight * VISIBLE_LINES}px` } : undefined"
        >
            <slot />
        </div>
        <UButton
            v-if="collapsible"
            :label="expanded ? t('Show less') : t('Show more')"
            :trailing-icon="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
            color="neutral"
            variant="link"
            size="sm"
            class="mt-1 px-0"
            @click="expanded = !expanded"
        />
    </div>
</template>
