const SECOND_PRESS_WINDOW_MS = 2000;
const OPEN_LAYER = '[role="dialog"], [role="menu"], [role="listbox"]';

export function useEscapeToStop(running: () => boolean, stop: () => void): Readonly<Ref<boolean>> {
    const armed = ref(false);
    let timer: ReturnType<typeof setTimeout> | undefined;

    function disarm(): void {
        clearTimeout(timer);
        armed.value = false;
    }

    function onKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Escape' || event.repeat || event.defaultPrevented || !running() || document.querySelector(OPEN_LAYER)) {
            return;
        }
        if (armed.value) {
            disarm();
            stop();
            return;
        }
        armed.value = true;
        timer = setTimeout(disarm, SECOND_PRESS_WINDOW_MS);
    }

    watch(running, (isRunning) => {
        if (!isRunning) {
            disarm();
        }
    });
    useActiveListener(() => window, 'keydown', onKeydown);
    onDeactivated(disarm);
    onBeforeUnmount(() => clearTimeout(timer));
    return readonly(armed);
}
