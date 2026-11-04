import { SettingsModal } from '#components';

export type SettingsCategory = 'profile' | 'appearance' | 'chat' | 'speech' | 'agents' | 'account' | 'people' | 'remote' | 'notifications';

export function useSettingsWindow() {
    const overlay = useOverlay();

    function open(category: SettingsCategory = 'appearance'): void {
        overlay.create(SettingsModal, { destroyOnClose: true, props: { category } }).open();
    }

    return { open };
}
