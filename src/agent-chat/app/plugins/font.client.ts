export default defineNuxtPlugin(() => {
    applyFont(cachedFont() ?? DEFAULT_FONT);
    applyTint(cachedTint());
});
