export function useUnread() {
    const { conversations } = useConversations();
    const { userId } = useUserName();
    const { reads, counts, markRead, refreshCounts } = useReads();
    const route = useRoute();
    const openId = computed(() => typeof route.params.id === 'string' ? route.params.id : null);

    const unreadIds = computed(() => counts.value ? unreadConversationIds(conversations.value, userId.value, counts.value, openId.value) : []);

    function isUnread(conversationId: string): boolean {
        return unreadIds.value.includes(conversationId);
    }

    function unreadCount(conversationId: string): number {
        return isUnread(conversationId) ? counts.value?.[conversationId] ?? 0 : 0;
    }

    function track(): void {
        watch([openId, conversations, reads], () => {
            const open = conversations.value.find(conversation => conversation.id === openId.value);
            if (open) {
                markRead(open);
            }
        }, { immediate: true });
        watch(() => conversations.value.map(conversation => `${conversation.id}:${conversation.lastPostedAt ?? 0}`).join(), (_, previous) => {
            if (previous) {
                refreshCounts();
            }
        });
    }

    return { unreadIds, isUnread, unreadCount, track };
}
