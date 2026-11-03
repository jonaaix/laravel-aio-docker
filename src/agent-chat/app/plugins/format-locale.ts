export default defineNuxtPlugin((nuxtApp) => {
    watch(nuxtApp.$i18n.locale, code => setFormatLocale(code), { immediate: true });
});
