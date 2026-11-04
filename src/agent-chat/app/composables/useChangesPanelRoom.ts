// Below this width the conversation gets too narrow to read comfortably; chat heads move above the messages earlier.
const MIN_CONVERSATION_PX = 720;

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
