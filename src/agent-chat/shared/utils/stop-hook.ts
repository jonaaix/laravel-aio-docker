import type { ChatPart } from '../types/conversation';

export const STOP_HOOK_FEEDBACK = 'Stop hook feedback:';

export const STOP_HOOK_PART: ChatPart = { type: 'data-stop-hook', data: null };

export function isStopHookMark(part: ChatPart): boolean {
    return part.type === STOP_HOOK_PART.type;
}

export function partsBeforeStopHook(parts: ChatPart[]): ChatPart[] {
    const index = parts.findIndex(isStopHookMark);
    return index === -1 ? parts : parts.slice(0, index);
}
