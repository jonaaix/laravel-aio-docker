import type { ConversationStatus } from '#shared/types/conversation';

export interface SessionState {
    label: string;
    pillClass: string;
}

const WORKING: SessionState = { label: 'Working', pillClass: 'bg-info/10 text-info' };
const ACTIVE: SessionState = { label: 'Active', pillClass: 'bg-success/10 text-success' };
const PAUSED: SessionState = { label: 'Paused', pillClass: 'bg-accented/70 text-toned' };

export function sessionState(status: ConversationStatus, turnActive: boolean): SessionState {
    if (turnActive) {
        return WORKING;
    }
    return status === 'running' ? ACTIVE : PAUSED;
}
