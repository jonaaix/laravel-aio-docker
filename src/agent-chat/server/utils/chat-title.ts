const CHAT_TITLE_KEY = 'chat-title';
const MAX_TITLE_LENGTH = 60;

export function chatTitle(): string | null {
    return readSetting(CHAT_TITLE_KEY);
}

export function setChatTitle(value: unknown): string | null {
    const title = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH) : '';
    if (title) {
        writeSetting(CHAT_TITLE_KEY, title);
        return title;
    }
    removeSetting(CHAT_TITLE_KEY);
    return null;
}
