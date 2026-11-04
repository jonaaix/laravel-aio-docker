import type { ChatUser } from '#shared/types/user';
import type { Participant } from '~/utils/avatars';

export function useUsers() {
    const users = useState<Record<string, ChatUser>>('users', () => ({}));

    function load(): Promise<void> {
        return loadWithSnapshot('users', () => apiFetch<ChatUser[]>('users'), (list) => {
            users.value = Object.fromEntries(list.map(user => [user.id, user]));
        });
    }

    function upsert(user: ChatUser): void {
        users.value = { ...users.value, [user.id]: user };
    }

    const names = computed(() => chatNames(Object.values(users.value)));

    function chatName(id: string | null | undefined): string | null {
        return id ? names.value[id] ?? null : null;
    }

    function participant(id: string | null | undefined): Participant {
        const user = id ? users.value[id] : undefined;
        return { kind: 'person', name: chatName(id) ?? '', seed: user?.avatarSeed, image: user?.avatarUrl };
    }

    return { users, names, load, upsert, chatName, participant };
}
