const TICK_MS = 60_000;

export function useNow() {
    const now = ref(Date.now());
    let timer: ReturnType<typeof setInterval> | undefined;
    onMounted(() => {
        timer = setInterval(() => {
            now.value = Date.now();
        }, TICK_MS);
    });
    onBeforeUnmount(() => clearInterval(timer));
    return now;
}
