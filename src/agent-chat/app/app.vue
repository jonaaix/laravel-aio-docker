<script setup lang="ts">
import * as uiLocales from '@nuxt/ui/locale';

const { locale } = useI18n();
const uiLocale = computed(() => uiLocales[locale.value as keyof typeof uiLocales] ?? uiLocales.en);

useHead({
    title: 'AI Chat',
    meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
    htmlAttrs: { lang: locale },
});
</script>

<template>
    <UApp :locale="uiLocale">
        <NuxtLayout>
            <NuxtPage />
        </NuxtLayout>
    </UApp>
</template>
