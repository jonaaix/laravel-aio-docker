import { SettingsModal } from '#components';

export type SettingsCategory = 'profile' | 'appearance' | 'agents' | 'account';

export function useSettingsWindow() {
    const overlay = useOverlay();

    function open(category: SettingsCategory = 'appearance'): void {
        overlay.create(SettingsModal, { destroyOnClose: true, props: { category } }).open();
    }

    return { open };
}
