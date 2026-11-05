import type { ChatMessage } from '#shared/types/conversation';

const FIRST_DRAWN_MESSAGES = 10;
const DRAW_STEP = 10;
const IDLE_FALLBACK_MS = 50;

export function useProgressiveDrawing(messages: Ref<ChatMessage[]>, scroller: () => HTMLElement) {
    const firstDrawnId = ref<string | null | undefined>(undefined);
    const drawnMessages = computed(() => {
        if (firstDrawnId.value === undefined) {
            return messages.value.slice(-FIRST_DRAWN_MESSAGES);
        }
        const start = firstDrawnId.value === null ? 0 : messages.value.findIndex(message => message.id === firstDrawnId.value);
        return start <= 0 ? messages.value : messages.value.slice(start);
    });
    const fullyDrawn = computed(() => drawnMessages.value.length >= messages.value.length);

    function anchorDrawing(): void {
        const all = messages.value;
        firstDrawnId.value = all.length > FIRST_DRAWN_MESSAGES ? all.at(-FIRST_DRAWN_MESSAGES)!.id : null;
    }

    function messageTop(messageId: string | undefined): number | null {
        const marker = messageId ? document.querySelector(`[data-read-along="${CSS.escape(messageId)}"]`) : null;
        return marker?.closest('article')?.getBoundingClientRect().top ?? null;
    }

    async function drawEarlier(): Promise<void> {
        const all = messages.value;
        const start = all.length - drawnMessages.value.length - DRAW_STEP;
        const keptId = drawnMessages.value[0]?.id;
        const keptTop = messageTop(keptId);
        firstDrawnId.value = start <= 0 ? null : all[start]!.id;
        await nextTick();
        const movedTop = messageTop(keptId);
        if (keptTop !== null && movedTop !== null) {
            scroller().scrollTop += movedTop - keptTop;
        }
    }

    function whenIdle(callback: () => void): void {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(callback);
            return;
        }
        setTimeout(callback, IDLE_FALLBACK_MS);
    }

    function drawRestWhenIdle(): void {
        if (fullyDrawn.value) {
            return;
        }
        whenIdle(() => void drawEarlier().then(drawRestWhenIdle));
    }

    function drawRestAfterPaint(): void {
        requestAnimationFrame(() => setTimeout(drawRestWhenIdle));
    }

    async function drawAll(): Promise<void> {
        firstDrawnId.value = null;
        await nextTick();
    }

    return { drawnMessages, fullyDrawn, anchorDrawing, drawEarlier, drawAll, drawRestAfterPaint };
}
