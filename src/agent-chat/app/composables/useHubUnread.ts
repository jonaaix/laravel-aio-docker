import type { ConversationSummary } from '#shared/types/conversation';

const OTHER_SERVERS_REFRESH_MS = 60_000;

const otherUnread = ref<Record<string, number>>({});
let polling: ReturnType<typeof setInterval> | undefined;

async function countOtherServers(): Promise<void> {
    if (document.visibilityState !== 'visible') {
        return;
    }
    const counts: Record<string, number> = {};
    await Promise.all(hubServers.value.filter(server => server.id !== activeServerId.value).map(async (server) => {
        try {
            const headers = { authorization: `Bearer ${await accessToken(server)}` };
            const [conversations, reads] = await Promise.all([
                $fetch<ConversationSummary[]>(serverApiUrl(server, 'conversations'), { headers }),
                $fetch<Record<string, number>>(serverApiUrl(server, 'reads'), { headers }),
            ]);
            counts[server.id] = unreadConversationIds(conversations, serverUserId(server.id), reads, null).length;
        }
        catch {
            counts[server.id] = otherUnread.value[server.id] ?? 0;
        }
    }));
    otherUnread.value = counts;
}

export function useHubUnread() {
    const { unreadIds } = useUnread();

    const unreadByServer = computed(() => activeServerId.value ? { ...otherUnread.value, [activeServerId.value]: unreadIds.value.length } : otherUnread.value);
    const total = computed(() => Object.values(unreadByServer.value).reduce((sum, count) => sum + count, 0));

    function track(): void {
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

    return { unreadByServer, total, track };
}
