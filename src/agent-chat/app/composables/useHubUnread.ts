import type { ConversationSummary } from '#shared/types/conversation';

type SeenMap = Record<string, number>;

const OTHER_SERVERS_REFRESH_MS = 60_000;
const SEEN_KEY_PREFIX = 'orbit-seen-';

const seenByServer = ref<Record<string, SeenMap>>({});
const otherUnread = ref<Record<string, number>>({});
let polling: ReturnType<typeof setInterval> | undefined;

function readSeen(serverId: string): SeenMap | null {
    try {
        const stored = localStorage.getItem(`${SEEN_KEY_PREFIX}${serverId}`);
        return stored ? JSON.parse(stored) as SeenMap : null;
    }
    catch {
        return null;
    }
}

function writeSeen(serverId: string, seen: SeenMap): void {
    seenByServer.value = { ...seenByServer.value, [serverId]: seen };
    try {
        localStorage.setItem(`${SEEN_KEY_PREFIX}${serverId}`, JSON.stringify(seen));
    }
    catch {
        // Blocked storage only forgets what was read; it is counted again after a reload.
    }
}

function seenFor(serverId: string, conversations: ConversationSummary[]): SeenMap {
    const known = seenByServer.value[serverId] ?? readSeen(serverId);
    if (known) {
        return known;
    }
    if (conversations.length === 0) {
        return {};
    }
    const first = Object.fromEntries(conversations.map(conversation => [conversation.id, conversation.lastAnswerAt ?? 0]));
    writeSeen(serverId, first);
    return first;
}

function unreadIds(conversations: ConversationSummary[], userId: string | null, seen: SeenMap, openId: string | null): string[] {
    return conversations
        .filter(conversation => conversation.archivedAt === null
            && conversation.id !== openId
            && userId !== null
            && conversation.participantIds.includes(userId)
            && (conversation.lastAnswerAt ?? 0) > (seen[conversation.id] ?? 0))
        .map(conversation => conversation.id);
}

async function countOtherServers(): Promise<void> {
    if (document.visibilityState !== 'visible') {
        return;
    }
    const counts: Record<string, number> = {};
    await Promise.all(hubServers.value.filter(server => server.id !== activeServerId.value).map(async (server) => {
        try {
            const token = await accessToken(server);
            const conversations = await $fetch<ConversationSummary[]>(serverApiUrl(server, 'conversations'), { headers: { authorization: `Bearer ${token}` } });
            counts[server.id] = unreadIds(conversations, serverUserId(server.id), seenFor(server.id, conversations), null).length;
        }
        catch {
            counts[server.id] = otherUnread.value[server.id] ?? 0;
        }
    }));
    otherUnread.value = counts;
}

export function useHubUnread() {
    const { conversations } = useConversations();
    const { userId } = useUserName();
    const route = useRoute();
    const openId = computed(() => typeof route.params.id === 'string' ? route.params.id : null);

    const activeUnread = computed(() => {
        const serverId = activeServerId.value;
        return serverId ? unreadIds(conversations.value, userId.value, seenFor(serverId, conversations.value), openId.value) : [];
    });

    const unreadByServer = computed(() => activeServerId.value ? { ...otherUnread.value, [activeServerId.value]: activeUnread.value.length } : otherUnread.value);
    const total = computed(() => Object.values(unreadByServer.value).reduce((sum, count) => sum + count, 0));

    function isUnread(conversationId: string): boolean {
        return activeUnread.value.includes(conversationId);
    }

    function track(): void {
        watch([openId, conversations], () => {
            const serverId = activeServerId.value;
            const open = conversations.value.find(conversation => conversation.id === openId.value);
            if (serverId && open) {
                const seen = seenFor(serverId, conversations.value);
                if ((seen[open.id] ?? 0) < (open.lastAnswerAt ?? 0)) {
                    writeSeen(serverId, { ...seen, [open.id]: open.lastAnswerAt ?? 0 });
                }
            }
        }, { immediate: true, deep: true });
        watch(total, (count) => {
            if ('setAppBadge' in navigator) {
                void (count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge()).catch(() => undefined);
            }
        }, { immediate: true });
        void countOtherServers();
        clearInterval(polling);
        polling = setInterval(() => void countOtherServers(), OTHER_SERVERS_REFRESH_MS);
        document.addEventListener('visibilitychange', () => void countOtherServers());
    }

    return { unreadByServer, total, isUnread, track };
}
