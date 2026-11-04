import type { FileUIPart } from 'ai';
import type { ChatMessage, ChatPart } from '#shared/types/conversation';

export type AnswerSegment =
    | { kind: 'part'; key: string; part: ChatPart }
    | { kind: 'images'; key: string; parts: FileUIPart[] }
    | { kind: 'stop-hook'; key: string; text: string }
    | { kind: 'compacted'; key: string };

function isImage(part: ChatPart): part is FileUIPart {
    return part.type === 'file' && part.mediaType.startsWith('image/');
}

export function answerSegments(message: ChatMessage): AnswerSegment[] {
    const segments: AnswerSegment[] = [];
    let afterStopHook = false;
    message.parts.forEach((part, index) => {
        if (isCompactionMark(part)) {
            segments.push({ kind: 'compacted', key: `${message.id}-${index}` });
            return;
        }
        if (isStopHookMark(part)) {
            afterStopHook = true;
            return;
        }
        if (afterStopHook) {
            const text = part.type === 'text' ? part.text.split('\n').filter(line => !SECTION_BAR.test(line) && line.trim()).join('\n').trim() : '';
            if (text) {
                segments.push({ kind: 'stop-hook', key: `${message.id}-${index}`, text });
            }
            return;
        }
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
