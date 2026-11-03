export type AfterTurnStep<T> =
    | { action: 'wait' }
    | { action: 'next-queued' }
    | { action: 'handoff'; target: T }
    | { action: 'finish'; notify: boolean }
    | { action: 'limit'; notify: true };

export interface AfterTurnState<T> {
    pausing: boolean;
    sessionBusy: boolean;
    hasQueued: boolean;
    stopped: boolean;
    failed: boolean;
    handoffs: number;
    handoffLimit: number;
    findTarget: () => T | null;
}

export function afterTurnStep<T>(state: AfterTurnState<T>): AfterTurnStep<T> {
    if (state.pausing || state.sessionBusy) {
        return { action: 'wait' };
    }
    if (state.hasQueued) {
        return { action: 'next-queued' };
    }
    const target = state.stopped || state.failed ? null : state.findTarget();
    if (!target) {
        return { action: 'finish', notify: !state.stopped };
    }
    if (state.handoffs >= state.handoffLimit) {
        return { action: 'limit', notify: true };
    }
    return { action: 'handoff', target };
}
