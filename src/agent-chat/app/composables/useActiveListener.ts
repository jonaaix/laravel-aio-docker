export function useActiveListener<E extends Event>(target: () => EventTarget, type: string, handler: (event: E) => void, options?: AddEventListenerOptions): void {
    let attached: EventTarget | null = null;
    const listener = handler as EventListener;

    function attach(): void {
        if (!attached) {
            attached = target();
            attached.addEventListener(type, listener, options);
        }
    }

    function detach(): void {
        attached?.removeEventListener(type, listener, options);
        attached = null;
    }

    onMounted(attach);
    onActivated(attach);
    onDeactivated(detach);
    onBeforeUnmount(detach);
}
