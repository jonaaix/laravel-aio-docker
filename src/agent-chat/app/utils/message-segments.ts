import type { ChatPart } from '#shared/types/conversation';

export type ToolPart = Extract<ChatPart, { type: 'dynamic-tool' }>;

export type MessageSegment =
  | { kind: 'part'; key: string; part: ChatPart }
  | { kind: 'tools'; key: string; parts: ToolPart[] };

export function messageSegments(messageId: string, parts: ChatPart[]): MessageSegment[] {
  const segments: MessageSegment[] = [];
  parts.forEach((part, index) => {
    const previous = segments.at(-1);
    if (part.type !== 'dynamic-tool') {
      segments.push({ kind: 'part', key: `${messageId}-${index}`, part });
    }
    else if (previous?.kind === 'tools') {
      previous.parts.push(part);
    }
    else {
      segments.push({ kind: 'tools', key: `${messageId}-${index}`, parts: [part] });
    }
  });
  return segments;
}
