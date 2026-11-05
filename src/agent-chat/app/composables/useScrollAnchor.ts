const KEY_PREFIX = 'chat-scroll:';
const SAVE_DELAY_MS = 250;

interface ScrollAnchor {
    messageId: string;
    offset: number;
}

function messageElements(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>('[data-read-along]')]
        .map(marker => marker.closest('article'))
        .filter((article): article is HTMLElement => article !== null);
}

export function useScrollAnchor(conversationId: string, topInset: () => number) {
    const key = KEY_PREFIX + conversationId;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    function read(): ScrollAnchor | null {
        try {
            const stored = sessionStorage.getItem(key);
            return stored ? JSON.parse(stored) as ScrollAnchor : null;
        }
        catch {
            return null;
        }
    }

    function write(anchor: ScrollAnchor | null): void {
        try {
            if (anchor) {
                sessionStorage.setItem(key, JSON.stringify(anchor));
            }
            else {
                sessionStorage.removeItem(key);
            }
        }
        catch {
            // Blocked storage only costs the remembered position.
        }
    }

    function current(): ScrollAnchor | null {
        const inset = topInset();
        const article = messageElements().find(element => element.getBoundingClientRect().bottom > inset);
        const messageId = article?.querySelector<HTMLElement>('[data-read-along]')?.dataset.readAlong;
        return article && messageId ? { messageId, offset: article.getBoundingClientRect().top } : null;
    }

    function remember(atBottom: boolean): void {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => write(atBottom ? null : current()), SAVE_DELAY_MS);
    }

    function apply(anchor: ScrollAnchor): boolean {
        const article = document.querySelector<HTMLElement>(`[data-read-along="${CSS.escape(anchor.messageId)}"]`)?.closest('article');
        if (!article) {
            return false;
        }
        const scroller = document.scrollingElement as HTMLElement;
        scroller.scrollTop += article.getBoundingClientRect().top - anchor.offset;
        return true;
    }

    onBeforeUnmount(() => clearTimeout(saveTimer));

    return { read, remember, apply };
}
