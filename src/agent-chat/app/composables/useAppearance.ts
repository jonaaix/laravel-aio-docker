import type { ChatUser } from '#shared/types/user';
import type { SpeechProvider } from '#shared/utils/speech';

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
    const changesPanelHidden = computed(() => user.value?.changesPanelHidden ?? false);
    const changesPanelAuto = computed(() => user.value?.changesPanelAuto ?? true);
    const doneSound = computed(() => user.value?.doneSound ?? true);
    const scaledPreviews = computed(() => user.value?.scaledPreviews ?? false);
    const thinkingAutoOpen = computed(() => user.value?.thinkingAutoOpen ?? true);
    const workingAutoOpen = computed(() => user.value?.workingAutoOpen ?? true);
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

    async function save(changes: { colorMode?: ColorModeChoice; font?: string; language?: string; pinSentMessage?: boolean; changesPanelHidden?: boolean; changesPanelAuto?: boolean; doneSound?: boolean; scaledPreviews?: boolean; thinkingAutoOpen?: boolean; workingAutoOpen?: boolean; tint?: number | null; speechRate?: number; speechVoice?: { provider: SpeechProvider; voice: string } }): Promise<void> {
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

    function speechVoiceFor(provider: SpeechProvider): string {
        return speechVoice(provider, user.value?.speechVoices?.[provider]).id;
    }

    function setSpeechVoice(provider: SpeechProvider, voice: string): Promise<void> {
        if (user.value) {
            user.value = { ...user.value, speechVoices: { ...user.value.speechVoices, [provider]: voice } };
        }
        return save({ speechVoice: { provider, voice } });
    }

    function setPinSentMessage(value: boolean): Promise<void> {
        return save({ pinSentMessage: value });
    }

    function setChangesPanelHidden(value: boolean): Promise<void> {
        if (user.value) {
            user.value = { ...user.value, changesPanelHidden: value };
        }
        return save({ changesPanelHidden: value });
    }

    function setChangesPanelAuto(value: boolean): Promise<void> {
        return save({ changesPanelAuto: value });
    }

    function setDoneSound(value: boolean): Promise<void> {
        return save({ doneSound: value });
    }

    function setScaledPreviews(value: boolean): Promise<void> {
        return save({ scaledPreviews: value });
    }

    function setThinkingAutoOpen(value: boolean): Promise<void> {
        return save({ thinkingAutoOpen: value });
    }

    function setWorkingAutoOpen(value: boolean): Promise<void> {
        return save({ workingAutoOpen: value });
    }

    return { font, mode, language, pinSentMessage, changesPanelHidden, changesPanelAuto, doneSound, scaledPreviews, thinkingAutoOpen, workingAutoOpen, tint, speechRate, adopt, setColorMode, setFont, setLanguage, setPinSentMessage, setChangesPanelHidden, setChangesPanelAuto, setDoneSound, setScaledPreviews, setThinkingAutoOpen, setWorkingAutoOpen, setSpeechRate, speechVoiceFor, setSpeechVoice, setTint };
}
