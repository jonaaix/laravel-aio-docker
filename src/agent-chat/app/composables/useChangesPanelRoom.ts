// Chat heads hang beside the messages; below this width the conversation clips them.
const MIN_CONVERSATION_PX = 1000;

export const CHANGES_PANEL_MIN_PX = 384;

export function useChangesPanelRoom(conversation: Ref<HTMLElement | null>): Readonly<Ref<number>> {
    const room = ref(0);
    let observer: ResizeObserver | undefined;
    const measure = () => {
        room.value = conversation.value ? window.innerWidth - conversation.value.getBoundingClientRect().left - MIN_CONVERSATION_PX : 0;
    };
    onMounted(() => {
        observer = new ResizeObserver(measure);
        if (conversation.value) {
            observer.observe(conversation.value);
        }
        window.addEventListener('resize', measure);
        measure();
    });
    onBeforeUnmount(() => {
        observer?.disconnect();
        window.removeEventListener('resize', measure);
    });
    return readonly(room);
}
