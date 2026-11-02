<script setup lang="ts">
const { font, mode, setColorMode, setFont } = useAppearance();

const modes: { value: ColorModeChoice; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: 'i-heroicons-sun' },
    { value: 'dark', label: 'Dark', icon: 'i-heroicons-moon' },
    { value: 'system', label: 'System', icon: 'i-heroicons-computer-desktop' },
];
</script>

<template>
    <div class="flex flex-col gap-6">
        <UFormField label="Theme">
            <div class="flex flex-wrap gap-2">
                <UButton
                    v-for="choice in modes"
                    :key="choice.value"
                    :label="choice.label"
                    :icon="choice.icon"
                    color="neutral"
                    :variant="mode === choice.value ? 'solid' : 'outline'"
                    @click="setColorMode(choice.value)"
                />
            </div>
        </UFormField>
        <UFormField label="Font">
            <div role="radiogroup" aria-label="Font" class="grid gap-2 sm:grid-cols-2">
                <button
                    v-for="choice in FONT_CHOICES"
                    :key="choice.value"
                    type="button"
                    role="radio"
                    :aria-checked="font === choice.value"
                    class="flex flex-col items-start gap-0.5 rounded-md px-3.5 py-2.5 text-start ring transition-colors duration-500 ease-out hover:bg-elevated"
                    :class="font === choice.value ? 'bg-elevated ring-inverted' : 'ring-default'"
                    :style="{ fontFamily: choice.stack }"
                    @click="setFont(choice.value)"
                >
                    <span class="text-base font-medium text-highlighted">{{ choice.label }}</span>
                    <span class="text-sm text-muted">The quick brown fox jumps over the lazy dog</span>
                </button>
            </div>
        </UFormField>
    </div>
</template>
