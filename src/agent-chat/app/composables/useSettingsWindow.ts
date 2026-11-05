import { SettingsModal } from '#components';

export const SETTINGS_CATEGORIES = ['profile', 'appearance', 'chat', 'speech', 'agents', 'account', 'people', 'remote', 'notifications'] as const;

export type SettingsCategory = typeof SETTINGS_CATEGORIES[number];

const SETTINGS_QUERY = 'settings';

export function isSettingsCategory(value: unknown): value is SettingsCategory {
    return (SETTINGS_CATEGORIES as readonly unknown[]).includes(value);
}

export function useSettingsWindow() {
    const route = useRoute();
    const router = useRouter();

    function open(category: SettingsCategory = 'appearance'): void {
        void router.push({ query: { ...route.query, [SETTINGS_QUERY]: category } });
    }

    function show(category: SettingsCategory): void {
        if (route.query[SETTINGS_QUERY] !== category) {
            void router.replace({ query: { ...route.query, [SETTINGS_QUERY]: category } });
        }
    }

    function close(): void {
        if (route.query[SETTINGS_QUERY] !== undefined) {
            void router.replace({ query: Object.fromEntries(Object.entries(route.query).filter(([key]) => key !== SETTINGS_QUERY)) });
        }
    }

    return { open, show, close };
}

export function followSettingsWindow(): void {
    const overlay = useOverlay();
    const route = useRoute();
    let modal: ReturnType<typeof overlay.create> | null = null;

    watch(() => route.query[SETTINGS_QUERY], (value) => {
        if (isSettingsCategory(value) && !modal) {
            modal = overlay.create(SettingsModal, { destroyOnClose: true, props: { category: value } });
            modal.open();
        }
        else if (!isSettingsCategory(value) && modal) {
            modal.close();
            modal = null;
        }
    }, { immediate: true });
}
