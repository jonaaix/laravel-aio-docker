import type { ChatUser } from '#shared/types/user';

const FONT_CACHE_KEY = 'chat-font';

export function applyFont(value: string): void {
    const choice = fontChoice(value);
    document.documentElement.style.setProperty('--font-sans', choice.stack);
    document.documentElement.style.setProperty('--font-scale', String(choice.scale ?? 1));
    try {
        localStorage.setItem(FONT_CACHE_KEY, value);
    }
    catch {
        // Blocked storage (private mode) only costs the cache; the font still applies to this page.
    }
}

export function cachedFont(): string | null {
    try {
        return localStorage.getItem(FONT_CACHE_KEY);
    }
    catch {
        return null;
    }
}

export function useAppearance() {
    const colorMode = useColorMode();
    const { user } = useUserName();
    const { upsert } = useUsers();
    const font = computed(() => user.value?.font ?? DEFAULT_FONT);
    const mode = computed(() => colorMode.preference as ColorModeChoice);
    const pinSentMessage = computed(() => user.value?.pinSentMessage ?? false);

    function adopt(chatUser: ChatUser): void {
        if (chatUser.colorMode) {
            colorMode.preference = chatUser.colorMode;
        }
        applyFont(chatUser.font ?? DEFAULT_FONT);
    }

    async function save(changes: { colorMode?: ColorModeChoice; font?: string; pinSentMessage?: boolean }): Promise<void> {
        if (!user.value) {
            return;
        }
        user.value = await apiFetch<ChatUser>(`users/${user.value.id}/appearance`, { method: 'POST', body: changes });
        upsert(user.value);
    }

    function setColorMode(value: ColorModeChoice): Promise<void> {
        colorMode.preference = value;
        return save({ colorMode: value });
    }

    function setFont(value: string): Promise<void> {
        applyFont(value);
        return save({ font: value });
    }

    function setPinSentMessage(value: boolean): Promise<void> {
        return save({ pinSentMessage: value });
    }

    return { font, mode, pinSentMessage, adopt, setColorMode, setFont, setPinSentMessage };
}
