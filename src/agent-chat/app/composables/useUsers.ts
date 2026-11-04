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

    function participant(id: string | null | undefined): Participant {
        const user = id ? users.value[id] : undefined;
        return { kind: 'person', name: user?.name ?? '', seed: user?.avatarSeed, image: user?.avatarUrl };
    }

    return { users, load, upsert, participant };
}
