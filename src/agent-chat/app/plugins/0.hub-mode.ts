export default defineNuxtPlugin(() => {
    const config = useRuntimeConfig();
    hubMode.value = config.public.hub === true;
    appBaseUrl.value = config.app.baseURL;
});
