<script setup lang="ts">
const { t } = useI18n();
const { font, mode, language, tint, setColorMode, setFont, setLanguage, setTint } = useAppearance();

const languageItems = LANGUAGES.map(choice => ({ value: choice.code, label: choice.name }));

const modes: { value: ColorModeChoice; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: 'i-heroicons-sun' },
    { value: 'dark', label: 'Dark', icon: 'i-heroicons-moon' },
    { value: 'system', label: 'System', icon: 'i-heroicons-computer-desktop' },
];
</script>

<template>
    <div class="flex flex-col gap-6">
        <UFormField :label="t('Language')">
            <USelect :model-value="language" :items="languageItems" class="w-full sm:w-64" @update:model-value="value => setLanguage(value)" />
        </UFormField>
        <UFormField :label="t('Theme')">
            <div class="flex flex-wrap gap-2">
                <UButton
                    v-for="choice in modes"
                    :key="choice.value"
                    :label="t(choice.label)"
                    :icon="choice.icon"
                    color="neutral"
                    :variant="mode === choice.value ? 'solid' : 'outline'"
                    @click="setColorMode(choice.value)"
                />
            </div>
        </UFormField>
        <UFormField :label="t('Font')">
            <div role="radiogroup" :aria-label="t('Font')" class="grid gap-2 sm:grid-cols-2">
                <button
                    v-for="choice in FONT_CHOICES"
                    :key="choice.value"
                    type="button"
                    role="radio"
                    :aria-checked="font === choice.value"
                    class="flex flex-col items-start gap-0.5 rounded-md px-3.5 py-2.5 text-start ring transition-colors duration-500 ease-out hover:bg-primary/10"
                    :class="font === choice.value ? 'bg-elevated ring-inverted' : 'ring-default'"
                    :style="{ fontFamily: choice.stack }"
                    @click="setFont(choice.value)"
                >
                    <span class="text-base font-medium text-highlighted">{{ choice.label }}</span>
                    <span class="text-sm text-muted">{{ t('The quick brown fox jumps over the lazy dog') }}</span>
                </button>
            </div>
        </UFormField>
        <UFormField :label="t('Color')">
            <div role="radiogroup" :aria-label="t('Color')" class="flex max-w-[32.5rem] flex-wrap gap-2">
                <UTooltip v-for="choice in TINT_CHOICES" :key="choice.value ?? 'black'" :text="t(choice.label)">
                    <button
                        type="button"
                        role="radio"
                        :aria-checked="tint === choice.value"
                        :aria-label="t(choice.label)"
                        class="flex size-9 items-center justify-center rounded-full transition-shadow duration-500 ease-out"
                        :class="tint === choice.value ? 'ring-2 ring-(--ui-text-highlighted)' : ''"
                        @click="setTint(choice.value)"
                    >
                        <span
                            class="size-6 rounded-full"
                            :class="choice.value === null ? 'bg-[oklch(0.205_0_0)] dark:bg-[oklch(0.922_0_0)]' : 'bg-[oklch(var(--swatch-lightness)_calc(0.18*var(--swatch-chroma))_var(--swatch-hue))] dark:bg-[oklch(var(--swatch-dark-lightness)_calc(0.14*var(--swatch-chroma))_var(--swatch-hue))]'"
                            :style="choice.value === null ? undefined : { '--swatch-hue': choice.value, '--swatch-chroma': tintChroma(choice.value), '--swatch-lightness': tintLightness(choice.value), '--swatch-dark-lightness': tintDarkLightness(choice.value) }"
                        />
                    </button>
                </UTooltip>
            </div>
        </UFormField>
    </div>
</template>
