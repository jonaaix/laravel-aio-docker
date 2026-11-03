import type { ChatUser } from '#shared/types/user';

const FONT_CACHE_KEY = 'chat-font';
const TINT_CACHE_KEY = 'chat-tint';
const TINT_SAVE_DELAY_MS = 400;

export function applyTint(value: number): void {
    document.documentElement.style.setProperty('--tint', String(value));
    try {
        localStorage.setItem(TINT_CACHE_KEY, String(value));
    }
    catch {
        // Blocked storage (private mode) only costs the cache; the tint still applies to this page.
    }
}

export function cachedTint(): number | null {
    try {
        const stored = Number(localStorage.getItem(TINT_CACHE_KEY));
        return isTint(stored) && localStorage.getItem(TINT_CACHE_KEY) !== null ? stored : null;
    }
    catch {
        return null;
    }
}

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
    const { locale, setLocale } = useI18n();
    const { user } = useUserName();
    const { upsert } = useUsers();
    const font = computed(() => user.value?.font ?? DEFAULT_FONT);
    const mode = computed(() => colorMode.preference as ColorModeChoice);
    const pinSentMessage = computed(() => user.value?.pinSentMessage ?? false);
    const language = computed(() => locale.value);
    const tint = computed(() => user.value?.tint ?? DEFAULT_TINT);
    let tintTimer: ReturnType<typeof setTimeout> | undefined;

    function adopt(chatUser: ChatUser): void {
        if (chatUser.colorMode) {
            colorMode.preference = chatUser.colorMode;
        }
        applyFont(chatUser.font ?? DEFAULT_FONT);
        applyTint(chatUser.tint ?? DEFAULT_TINT);
        if (chatUser.language) {
            void setLocale(chatUser.language as typeof locale.value);
        }
    }

    async function save(changes: { colorMode?: ColorModeChoice; font?: string; language?: string; pinSentMessage?: boolean; tint?: number }): Promise<void> {
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

    async function setLanguage(value: string): Promise<void> {
        await setLocale(value as typeof locale.value);
        return save({ language: value });
    }

    function setTint(value: number): void {
        applyTint(value);
        if (user.value) {
            user.value = { ...user.value, tint: value };
        }
        clearTimeout(tintTimer);
        tintTimer = setTimeout(() => void save({ tint: value }), TINT_SAVE_DELAY_MS);
    }

    function setPinSentMessage(value: boolean): Promise<void> {
        return save({ pinSentMessage: value });
    }

    return { font, mode, language, pinSentMessage, tint, adopt, setColorMode, setFont, setLanguage, setPinSentMessage, setTint };
}
