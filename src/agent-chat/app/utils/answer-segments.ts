import type { FileUIPart } from 'ai';
import type { ChatMessage, ChatPart } from '#shared/types/conversation';

export type AnswerSegment =
    | { kind: 'part'; key: string; part: ChatPart }
    | { kind: 'images'; key: string; parts: FileUIPart[] };

function isImage(part: ChatPart): part is FileUIPart {
    return part.type === 'file' && part.mediaType.startsWith('image/');
}

export function answerSegments(message: ChatMessage): AnswerSegment[] {
    const segments: AnswerSegment[] = [];
    message.parts.forEach((part, index) => {
        if (part.type !== 'text' && part.type !== 'file') {
            return;
        }
        const previous = segments.at(-1);
        if (isImage(part) && previous?.kind === 'images') {
            previous.parts.push(part);
        }
        else if (isImage(part)) {
            segments.push({ kind: 'images', key: `${message.id}-${index}`, parts: [part] });
        }
        else {
            segments.push({ kind: 'part', key: `${message.id}-${index}`, part });
        }
    });
    return segments;
}
