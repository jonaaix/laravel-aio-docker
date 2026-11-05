const MAX_INITIALS = 2;

export function chatInitials(title: string): string {
    const words = title.match(/\p{L}[\p{L}\p{N}]*|\p{N}+/gu) ?? [];
    return words.slice(0, MAX_INITIALS).map(word => word[0]!.toUpperCase()).join('') || '#';
}
