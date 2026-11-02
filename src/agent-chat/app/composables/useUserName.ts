const USER_COOKIE = 'chat-user-id';
const LEGACY_NAME_COOKIE = 'chat-user-name';
const LOCKED_COOKIE = 'chat-user-name-locked';
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

interface ChatUser {
    id: string;
    name: string;
}

function decodeBase64Url(value: string): string | null {
    try {
        const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
        const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
        return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
    }
    catch {
        return null;
    }
}

export function useUserName() {
    const cookieOptions = {
        maxAge: COOKIE_MAX_AGE_S,
        sameSite: 'lax' as const,
        encode: (value: string | null) => encodeURIComponent(value ?? ''),
        decode: (value: string) => decodeURIComponent(value),
    };
    const userCookie = useCookie<string | null>(USER_COOKIE, { ...cookieOptions, default: () => null });
    const legacyNameCookie = useCookie<string | null>(LEGACY_NAME_COOKIE, { ...cookieOptions, default: () => null });
    const lockedCookie = useCookie<string | null>(LOCKED_COOKIE, { ...cookieOptions, default: () => null });
    const user = useState<ChatUser | null>('chat-user', () => null);
    const ready = useState<boolean>('chat-user-ready', () => false);
    const locked = useState<boolean>('chat-user-locked', () => lockedCookie.value === 'true');
    const editing = useState<boolean>('chat-user-editing', () => false);
    const userId = computed(() => user.value?.id ?? null);
    const name = computed(() => user.value?.name ?? null);

    function remember(value: ChatUser, lock: boolean): void {
        user.value = value;
        userCookie.value = value.id;
        legacyNameCookie.value = null;
        locked.value = lock;
        lockedCookie.value = lock ? 'true' : null;
    }

    async function signIn(rawName: string, lock: boolean): Promise<void> {
        const normalized = normalizeUserName(rawName);
        if (normalized) {
            remember(await apiFetch<ChatUser>('users', { method: 'POST', body: { name: normalized } }), lock);
        }
    }

    async function restore(): Promise<void> {
        if (ready.value) {
            return;
        }
        try {
            if (userCookie.value) {
                user.value = await apiFetch<ChatUser>(`users/${userCookie.value}`);
            }
            else if (legacyNameCookie.value) {
                await signIn(legacyNameCookie.value, locked.value);
            }
        }
        catch {
            user.value = null;
            userCookie.value = null;
        }
        finally {
            ready.value = true;
        }
    }

    async function save(rawName: string): Promise<void> {
        if (locked.value) {
            return;
        }
        if (user.value) {
            const normalized = normalizeUserName(rawName);
            if (normalized) {
                remember(await apiFetch<ChatUser>(`users/${user.value.id}/rename`, { method: 'POST', body: { name: normalized } }), false);
            }
        }
        else {
            await signIn(rawName, false);
        }
        editing.value = false;
    }

    async function adopt(encoded: string): Promise<void> {
        const decoded = decodeBase64Url(encoded);
        if (decoded) {
            await signIn(decoded, true);
        }
        ready.value = true;
    }

    return { user, userId, name, ready, locked, editing, restore, save, adopt };
}
