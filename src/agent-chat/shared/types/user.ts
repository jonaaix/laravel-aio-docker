export interface ChatUser {
    id: string;
    name: string;
    avatarSeed: string | null;
    avatarUrl: string | null;
    avatarLocked: boolean;
    colorMode: 'light' | 'dark' | 'system' | null;
    font: string | null;
    language: string | null;
    pinSentMessage: boolean;
    tint: number | null;
    speechRate: number | null;
    admin: boolean;
    blocked: boolean;
    accountDetails: 'shown' | 'hidden' | null;
}
