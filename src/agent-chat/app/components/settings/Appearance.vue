<script setup lang="ts">
const { t } = useI18n();
const { font, mode, language, pinSentMessage, tint, setColorMode, setFont, setLanguage, setPinSentMessage, setTint } = useAppearance();

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
                    class="flex flex-col items-start gap-0.5 rounded-md px-3.5 py-2.5 text-start ring transition-colors duration-500 ease-out hover:bg-elevated"
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
            <div role="radiogroup" :aria-label="t('Color')" class="flex flex-wrap gap-2">
                <button
                    v-for="choice in TINT_CHOICES"
                    :key="choice.value"
                    type="button"
                    role="radio"
                    :aria-checked="tint === choice.value"
                    class="flex h-9 items-center gap-2 rounded-full px-3 text-sm ring transition-colors duration-500 ease-out hover:bg-elevated"
                    :class="tint === choice.value ? 'bg-elevated text-highlighted ring-inverted' : 'text-toned ring-default'"
                    @click="setTint(choice.value)"
                >
                    <span class="size-4 rounded-full ring ring-black/10 dark:ring-white/15" :style="{ background: `oklch(0.72 0.09 ${choice.value})` }" />
                    {{ t(choice.label) }}
                </button>
            </div>
        </UFormField>
        <UFormField :label="t('Conversation')">
            <USwitch
                :model-value="pinSentMessage"
                :label="t('Move sent message to top')"
                @update:model-value="value => setPinSentMessage(value === true)"
            />
        </UFormField>
    </div>
</template>
