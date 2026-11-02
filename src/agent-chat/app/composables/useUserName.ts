const NAME_COOKIE = 'chat-user-name';
const LOCKED_COOKIE = 'chat-user-name-locked';
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

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
    const nameCookie = useCookie<string | null>(NAME_COOKIE, { ...cookieOptions, default: () => null });
    const lockedCookie = useCookie<string | null>(LOCKED_COOKIE, { ...cookieOptions, default: () => null });
    const name = useState<string | null>('user-name', () => normalizeUserName(nameCookie.value));
    const locked = useState<boolean>('user-name-locked', () => lockedCookie.value === 'true');
    const editing = useState<boolean>('user-name-editing', () => false);

    function store(value: string, lock: boolean): void {
        name.value = value;
        nameCookie.value = value;
        locked.value = lock;
        lockedCookie.value = lock ? 'true' : null;
    }

    function save(value: string): boolean {
        const normalized = normalizeUserName(value);
        if (!normalized || locked.value) {
            return false;
        }
        store(normalized, false);
        editing.value = false;
        return true;
    }

    function adopt(encoded: string): boolean {
        const normalized = normalizeUserName(decodeBase64Url(encoded));
        if (normalized) {
            store(normalized, true);
        }
        return normalized !== null;
    }

    return { name, locked, editing, save, adopt };
}
