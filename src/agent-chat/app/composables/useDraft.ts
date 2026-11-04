const DRAFT_PREFIX = 'chat-draft:';

export function useDraft(key: string, text: Ref<string>): void {
    if (!import.meta.client) {
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
