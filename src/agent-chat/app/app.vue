<script setup lang="ts">
import * as uiLocales from '@nuxt/ui/locale';

const { locale } = useI18n();
const { user, ready, removed, signIn } = useUserName();
const { app, public: { hub } } = useRuntimeConfig();
const pairing = ref<PendingPairing | null>(hub ? takePendingPairing() : null);
const reconnecting = ref(false);
void signIn();
const uiLocale = computed(() => uiLocales[locale.value as keyof typeof uiLocales] ?? uiLocales.en);


useHead({
    title: hub ? 'Orbit' : 'AI Chat',
    meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        ...(hub ? [
            { name: 'apple-mobile-web-app-capable', content: 'yes' },
            { name: 'apple-mobile-web-app-title', content: 'Orbit' },
            { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
            { name: 'theme-color', content: '#07061a' },
        ] : []),
    ],
    link: hub ? [
        { rel: 'manifest', href: `${app.baseURL}manifest.webmanifest` },
        { rel: 'apple-touch-icon', href: `${app.baseURL}icons/apple-touch-icon.png` },
        { rel: 'icon', type: 'image/svg+xml', href: `${app.baseURL}orbit-icon.svg` },
    ] : [],
    htmlAttrs: { lang: locale },
});
</script>

<template>
    <UApp :locale="uiLocale">
        <template v-if="ready">
            <HubWelcome v-if="hub && (pairing || reconnecting || !activeServer)" :pairing="pairing" @cancel="pairing = null; reconnecting = false" />
            <HubDeviceRemoved v-else-if="hub && removed" @reconnect="reconnecting = true" />
            <NuxtLayout v-else-if="user">
                <NuxtPage />
            </NuxtLayout>
            <Unauthorized v-else />
        </template>
    </UApp>
</template>
