import type { UploadedFile } from '#shared/types/conversation';
import type { ChatUser } from '#shared/types/user';

const SIGN_IN_PARAMS = ['n', 'a', 'exp', 'nonce', 'sig'] as const;

function takeSignInParams(): Record<string, string> | null {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('sig')) {
        return null;
    }
    const params = Object.fromEntries(SIGN_IN_PARAMS.map(name => [name, url.searchParams.get(name) ?? '']));
    SIGN_IN_PARAMS.forEach(name => url.searchParams.delete(name));
    window.history.replaceState(window.history.state, '', url);
    return params;
}

export function useUserName() {
    const user = useState<ChatUser | null>('chat-user', () => null);
    const ready = useState<boolean>('chat-user-ready', () => false);
    const removed = useState<boolean>('chat-device-removed', () => false);
    const { upsert } = useUsers();
    const userId = computed(() => user.value?.id ?? null);
    const name = computed(() => user.value?.name ?? null);

    async function signIn(): Promise<void> {
        if (ready.value) {
            return;
        }
        if (hubMode.value) {
            await signInToHubServer();
            return;
        }
        const params = takeSignInParams();
        try {
            user.value = params
                ? await apiFetch<ChatUser>('auth/session', { method: 'POST', body: params })
                : await apiFetch<ChatUser>('auth/me');
            upsert(user.value);
        }
        catch {
            user.value = params ? await apiFetch<ChatUser>('auth/me').catch(() => null) : null;
        }
        finally {
            ready.value = true;
        }
    }

    async function signInToHubServer(): Promise<void> {
        try {
            await loadHubServers(takeRequestedServer());
            user.value = activeServer.value ? await apiFetch<ChatUser>('auth/me') : null;
            if (user.value) {
                upsert(user.value);
            }
        }
        catch (failure) {
            user.value = null;
            removed.value = failure instanceof DeviceRemovedError;
        }
        finally {
            ready.value = true;
        }
    }

    async function setAvatar(upload: UploadedFile | null): Promise<void> {
        if (user.value) {
            user.value = await apiFetch<ChatUser>(`users/${user.value.id}/avatar`, { method: 'POST', body: { upload } });
            upsert(user.value);
        }
    }

    async function setAvatarSeed(seed: string): Promise<void> {
        if (user.value) {
            user.value = await apiFetch<ChatUser>(`users/${user.value.id}/avatar-seed`, { method: 'POST', body: { seed } });
            upsert(user.value);
        }
    }

    return { user, userId, name, ready, removed, signIn, setAvatar, setAvatarSeed };
}
