import type { ConversationStatus } from '#shared/types/conversation';

export interface SessionState {
    label: string;
    dotClass: string;
    pillClass: string;
}

const WORKING: SessionState = { label: 'Working', dotClass: 'bg-primary animate-pulse', pillClass: 'bg-info/10 text-info' };
const ACTIVE: SessionState = { label: 'Active', dotClass: 'bg-success', pillClass: 'bg-success/10 text-success' };
const PAUSED: SessionState = { label: 'Paused', dotClass: 'bg-neutral-300 dark:bg-neutral-600', pillClass: 'bg-accented/70 text-toned' };

export function sessionState(status: ConversationStatus, turnActive: boolean): SessionState {
    if (turnActive) {
        return WORKING;
    }
    return status === 'running' ? ACTIVE : PAUSED;
}
