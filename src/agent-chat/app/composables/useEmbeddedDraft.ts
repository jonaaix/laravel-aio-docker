const DRAFT_PREFIX = 'chat-draft:';

export function isEmbedded(): boolean {
    return import.meta.client && window.top !== window.self;
}

export function useEmbeddedDraft(key: string, text: Ref<string>): void {
    if (!isEmbedded()) {
        return;
    }
    const storageKey = `${DRAFT_PREFIX}${key}`;
    try {
        const saved = localStorage.getItem(storageKey);
        if (saved && !text.value) {
            text.value = saved;
        }
    }
    catch {
        return;
    }
    watch(text, (value) => {
        try {
            if (value.trim()) {
                localStorage.setItem(storageKey, value);
            }
            else {
                localStorage.removeItem(storageKey);
            }
        }
        catch {
            // Blocked storage only costs keeping the draft across reloads.
        }
    });
}
