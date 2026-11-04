export function useUnread() {
    const { conversations } = useConversations();
    const { userId } = useUserName();
    const { reads, markRead } = useReads();
    const route = useRoute();
    const openId = computed(() => typeof route.params.id === 'string' ? route.params.id : null);

    const unreadIds = computed(() => reads.value ? unreadConversationIds(conversations.value, userId.value, reads.value, openId.value) : []);

    function isUnread(conversationId: string): boolean {
        return unreadIds.value.includes(conversationId);
    }

    function track(): void {
        watch([openId, conversations, reads], () => {
            const open = conversations.value.find(conversation => conversation.id === openId.value);
            if (open) {
                markRead(open);
            }
        }, { immediate: true });
    }

    return { unreadIds, isUnread, track };
}
