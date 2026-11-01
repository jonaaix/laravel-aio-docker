<script setup>
defineOptions({ inheritAttrs: false });

defineProps({
    label: { type: String, required: true },
    href: { type: String, default: null },
    size: { type: String, default: 'md' },
    tone: { type: String, default: 'plain' },
});

const SIZES = { md: 'size-9', lg: 'size-10', xl: 'size-12' };
</script>

<template>
    <UTooltip :text="label">
        <component
            :is="href ? 'a' : 'button'"
            v-bind="$attrs"
            :href="href ?? undefined"
            :target="href ? '_blank' : undefined"
            :rel="href ? 'noopener' : undefined"
            :type="href ? undefined : 'button'"
            :aria-label="label"
            class="inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-white/60 [&>svg]:size-5"
            :class="SIZES[size] ?? SIZES.md"
        >
            <slot />
        </component>
    </UTooltip>
</template>
