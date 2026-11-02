export const USER_NAME_MAX_LENGTH = 60;

export function normalizeUserName(value: unknown): string | null {
    const name = typeof value === 'string' ? value.trim() : '';
    return name && name.length <= USER_NAME_MAX_LENGTH ? name : null;
}
