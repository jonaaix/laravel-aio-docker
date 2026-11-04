import { SettingsModal } from '#components';

export type SettingsCategory = 'profile' | 'appearance' | 'speech' | 'agents' | 'account' | 'remote' | 'notifications';

export function useSettingsWindow() {
    const overlay = useOverlay();

    function open(category: SettingsCategory = 'appearance'): void {
        overlay.create(SettingsModal, { destroyOnClose: true, props: { category } }).open();
    }

    return { open };
}
