import type { ChatUser } from '#shared/types/user';

const FONT_CACHE_KEY = 'chat-font';
const TINT_CACHE_KEY = 'chat-tint';

export function applyTint(value: number | null): void {
    const root = document.documentElement;
    root.style.setProperty('--tint', String(value ?? 0));
    root.style.setProperty('--tint-chroma', String(tintChroma(value)));
    root.style.setProperty('--tint-lightness', String(tintLightness(value)));
    root.style.setProperty('--tint-dark-lightness', String(tintDarkLightness(value)));
    root.toggleAttribute('data-tint-neutral', value === null);
    try {
        localStorage.setItem(TINT_CACHE_KEY, String(value));
    }
    catch {
        // Blocked storage (private mode) only costs the cache; the colour still applies to this page.
    }
}

export function cachedTint(): number | null {
    try {
        const stored = localStorage.getItem(TINT_CACHE_KEY);
        const value = stored === null || stored === 'null' ? null : Number(stored);
        return isTint(value) ? value : null;
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
    const tint = computed(() => isTint(user.value?.tint) ? user.value?.tint ?? null : DEFAULT_TINT);
    const speechRate = computed(() => isSpeechRate(user.value?.speechRate) ? user.value.speechRate : DEFAULT_SPEECH_RATE);

    function adopt(chatUser: ChatUser): void {
        if (chatUser.colorMode) {
            colorMode.preference = chatUser.colorMode;
        }
        applyFont(chatUser.font ?? DEFAULT_FONT);
        applyTint(isTint(chatUser.tint) ? chatUser.tint : DEFAULT_TINT);
        if (chatUser.language) {
            void setLocale(chatUser.language as typeof locale.value);
        }
    }

    async function save(changes: { colorMode?: ColorModeChoice; font?: string; language?: string; pinSentMessage?: boolean; tint?: number | null; speechRate?: number }): Promise<void> {
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

    function setTint(value: number | null): Promise<void> {
        applyTint(value);
        return save({ tint: value });
    }

    function setSpeechRate(value: number): Promise<void> {
        return save({ speechRate: value });
    }

    function setPinSentMessage(value: boolean): Promise<void> {
        return save({ pinSentMessage: value });
    }

    return { font, mode, language, pinSentMessage, tint, speechRate, adopt, setColorMode, setFont, setLanguage, setPinSentMessage, setSpeechRate, setTint };
}
