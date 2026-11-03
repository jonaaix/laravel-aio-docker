import type { ConversationStatus } from '#shared/types/conversation';

export interface SessionState {
    label: string;
    pillClass: string;
    dotClass: string;
    live: boolean;
}

const WORKING: SessionState = { label: 'Working', pillClass: 'bg-info/10 text-info', dotClass: 'bg-info', live: true };
const ACTIVE: SessionState = { label: 'Active', pillClass: 'bg-success/10 text-success', dotClass: 'bg-success', live: false };
const PAUSED: SessionState = { label: 'Paused', pillClass: 'bg-accented/70 text-toned', dotClass: 'bg-(--ui-text-dimmed)', live: false };

export function sessionState(status: ConversationStatus, turnActive: boolean): SessionState {
    if (turnActive) {
        return WORKING;
    }
    return status === 'running' ? ACTIVE : PAUSED;
}
