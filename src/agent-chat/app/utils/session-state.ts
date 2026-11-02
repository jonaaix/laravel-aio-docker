import type { ConversationStatus } from '#shared/types/conversation';

export interface SessionState {
    label: string;
    dotClass: string;
}

const WORKING: SessionState = { label: 'Working', dotClass: 'bg-primary animate-pulse' };
const ACTIVE: SessionState = { label: 'Active', dotClass: 'bg-success' };
const PAUSED: SessionState = { label: 'Paused', dotClass: 'bg-neutral-300 dark:bg-neutral-600' };

export function sessionState(status: ConversationStatus, turnActive: boolean): SessionState {
    if (turnActive) {
        return WORKING;
    }
    return status === 'running' ? ACTIVE : PAUSED;
}
