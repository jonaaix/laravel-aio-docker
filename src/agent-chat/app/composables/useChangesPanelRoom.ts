// Below this width the reading column would have to narrow to keep the chat heads beside it.
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
        measure();
    });
    useActiveListener(() => window, 'resize', measure);
    onActivated(measure);
    onBeforeUnmount(() => observer?.disconnect());
    return readonly(room);
}
