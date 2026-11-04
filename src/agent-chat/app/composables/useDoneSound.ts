import type { ConversationSummary } from '#shared/types/conversation';

const CLAIM_LOCK = 'agent-chat-done-sound';
const CLAIM_KEY = 'agent-chat.done-sound';
const REMEMBERED_CLAIMS = 20;

function claimedElsewhere(claim: string): boolean {
    try {
        const claims = JSON.parse(localStorage.getItem(CLAIM_KEY) ?? '[]') as string[];
        if (claims.includes(claim)) {
            return true;
        }
        localStorage.setItem(CLAIM_KEY, JSON.stringify([...claims, claim].slice(-REMEMBERED_CLAIMS)));
    }
    catch {
        return false;
    }
    return false;
}

function playOnce(claim: string): void {
    if (!navigator.locks) {
        playDoneSound();
        return;
    }
    void navigator.locks.request(CLAIM_LOCK, () => {
        if (!claimedElsewhere(claim)) {
            playDoneSound();
        }
    });
}

export function useDoneSound() {
    const { conversations } = useConversations();
    const { userId } = useUserName();
    const { doneSound } = useAppearance();
    const route = useRoute();
    const answeredAt = new Map<string, number>();

    function inView(conversation: ConversationSummary): boolean {
        return conversation.id === route.params.id && document.visibilityState === 'visible';
    }

    function wantsSound(conversation: ConversationSummary): boolean {
        return doneSound.value
            && conversation.archivedAt === null
            && userId.value !== null
            && conversation.participantIds.includes(userId.value)
            && !inView(conversation);
    }

    function track(): void {
        if (import.meta.server) {
            return;
        }
        armDoneSound();
        watch(conversations, (list) => {
            for (const conversation of list) {
                const latest = conversation.lastAnswerAt ?? 0;
                const before = answeredAt.get(conversation.id);
                answeredAt.set(conversation.id, latest);
                if (before !== undefined && latest > before && wantsSound(conversation)) {
                    playOnce(`${conversation.id}:${latest}`);
                }
            }
        }, { immediate: true });
    }

    return { track };
}
