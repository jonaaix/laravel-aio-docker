import { AgentsModal } from '#components';

export function useAgentsWindow() {
    const overlay = useOverlay();

    function open(): void {
        overlay.create(AgentsModal, { destroyOnClose: true }).open();
    }

    return { open };
}
