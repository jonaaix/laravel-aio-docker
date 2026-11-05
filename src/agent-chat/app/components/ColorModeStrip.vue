<script setup lang="ts">
import type { OptionStripItem } from '~/components/OptionStrip.vue';

const { t } = useI18n();
const { mode, setColorMode } = useAppearance();

const items = computed<OptionStripItem<ColorModeChoice>[]>(() => [
    { value: 'system', label: t('System'), icon: 'i-heroicons-computer-desktop' },
    { value: 'light', label: t('Light'), icon: 'i-heroicons-sun' },
    { value: 'dark', label: t('Dark'), icon: 'i-heroicons-moon' },
]);

const choice = computed<ColorModeChoice>({
    get: () => mode.value,
    set: value => setColorMode(value),
});
</script>

<template>
    <OptionStrip v-model="choice" :items="items" :label="t('Theme')" size="sm" block />
</template>
