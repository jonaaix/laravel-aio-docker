import type { ConversationStatus } from '#shared/types/conversation';

export interface SessionState {
    label: string;
    pillClass: string;
    dotClass: string;
    live: boolean;
    backgroundTasks: number;
}

const WORKING: SessionState = { label: 'Working', pillClass: 'bg-info/10 text-info', dotClass: 'bg-info', live: true, backgroundTasks: 0 };
const ACTIVE: SessionState = { label: 'Ready', pillClass: 'bg-success/10 text-success', dotClass: 'bg-success', live: false, backgroundTasks: 0 };
const BACKGROUND: SessionState = { label: 'Running in the background', pillClass: 'bg-info/10 text-info', dotClass: 'bg-info', live: false, backgroundTasks: 0 };
const PAUSED: SessionState = { label: 'Paused', pillClass: 'bg-accented/70 text-toned', dotClass: 'bg-(--ui-text-dimmed)', live: false, backgroundTasks: 0 };

export function sessionState(status: ConversationStatus, turnActive: boolean, backgroundTasks = 0): SessionState {
    if (turnActive) {
        return WORKING;
    }
    if (status === 'running' && backgroundTasks > 0) {
        return { ...BACKGROUND, backgroundTasks };
    }
    return status === 'running' ? ACTIVE : PAUSED;
}
