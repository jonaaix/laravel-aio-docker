import { SettingsModal } from '#components';

export type SettingsCategory = 'profile' | 'appearance' | 'agents';

export function useSettingsWindow() {
    const overlay = useOverlay();

    function open(category: SettingsCategory = 'profile'): void {
        overlay.create(SettingsModal, { destroyOnClose: true, props: { category } }).open();
    }

    return { open };
}
