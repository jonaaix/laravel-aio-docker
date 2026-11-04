import type { ChatMessage } from '#shared/types/conversation';

export function messageText(message: ChatMessage): string {
    return partsBeforeStopHook(message.parts)
        .flatMap(part => part.type === 'text' && part.text.trim() ? [part.text.trim()] : [])
        .join('\n\n');
}
