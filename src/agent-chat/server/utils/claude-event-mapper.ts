import type { ClaudeEvent } from '#claude-threads/claude/cli';
import type { ChatPart } from '../../shared/types/conversation';
import { STOP_HOOK_FEEDBACK, STOP_HOOK_PART } from '../../shared/utils/stop-hook';

interface ClaudeContentBlock {
    type: string;
    text?: string;
    thinking?: string;
    id?: string;
    name?: string;
    input?: unknown;
    tool_use_id?: string;
    content?: unknown;
    is_error?: boolean;
}

// The history keeps a tool call's beginning, enough to see why it failed; full output would bloat the database.
const MAX_TOOL_OUTPUT_CHARS = 2_000;

function contentBlocks(event: ClaudeEvent): ClaudeContentBlock[] {
    const message = event.message as { content?: unknown } | undefined;
    return Array.isArray(message?.content) ? message.content as ClaudeContentBlock[] : [];
}

function toolResultText(content: unknown): string {
    if (typeof content === 'string') {
        return content;
    }
    if (!Array.isArray(content)) {
        return '';
    }
    return content
        .map((block: ClaudeContentBlock) => block.type === 'text' ? block.text ?? '' : `[${block.type}]`)
        .join('\n');
}

function capped(text: string): string {
    return text.length > MAX_TOOL_OUTPUT_CHARS
        ? `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n… (${text.length - MAX_TOOL_OUTPUT_CHARS} more characters)`
        : text;
}

function assistantBlockToPart(block: ClaudeContentBlock): ChatPart | null {
    if (block.type === 'text' && block.text?.trim()) {
        return { type: 'text', text: block.text, state: 'done' };
    }
    if (block.type === 'thinking' && block.thinking?.trim()) {
        return { type: 'reasoning', text: block.thinking, state: 'done' };
    }
    if (block.type === 'tool_use' && block.id && block.name) {
        return { type: 'dynamic-tool', toolName: block.name, toolCallId: block.id, state: 'input-available', input: block.input };
    }
    return null;
}

function applyToolResult(parts: ChatPart[], block: ClaudeContentBlock): number | null {
    const index = parts.findIndex(part => part.type === 'dynamic-tool' && part.toolCallId === block.tool_use_id);
    const part = parts[index];
    if (!part || part.type !== 'dynamic-tool') {
        return null;
    }
    const text = capped(toolResultText(block.content));
    parts[index] = block.is_error
        ? { type: 'dynamic-tool', toolName: part.toolName, toolCallId: part.toolCallId, state: 'output-error', input: part.input, errorText: text }
        : { type: 'dynamic-tool', toolName: part.toolName, toolCallId: part.toolCallId, state: 'output-available', input: part.input, output: text };
    return index;
}

interface StreamEvent {
    type?: string;
    content_block?: { type?: string; id?: string; name?: string };
    delta?: { type?: string; text?: string; thinking?: string };
}

function innerStreamEvent(event: ClaudeEvent): StreamEvent | null {
    return event.type === 'stream_event' && !event.parent_tool_use_id ? event.event as StreamEvent : null;
}

export function streamStartPart(event: ClaudeEvent): ChatPart | null {
    const inner = innerStreamEvent(event);
    if (inner?.type !== 'content_block_start') {
        return null;
    }
    const block = inner.content_block;
    if (block?.type === 'text') {
        return { type: 'text', text: '', state: 'streaming' };
    }
    if (block?.type === 'thinking') {
        return { type: 'reasoning', text: '', state: 'streaming' };
    }
    if (block?.type === 'tool_use' && block.id && block.name) {
        return { type: 'dynamic-tool', toolName: block.name, toolCallId: block.id, state: 'input-streaming', input: undefined };
    }
    return null;
}

export function streamDeltaText(event: ClaudeEvent): string | null {
    const inner = innerStreamEvent(event);
    if (inner?.type !== 'content_block_delta') {
        return null;
    }
    return inner.delta?.text ?? inner.delta?.thinking ?? null;
}

export function applyClaudeEvent(parts: ChatPart[], event: ClaudeEvent): number[] {
    // Subagent sidechains are not rendered yet; their outcome still reaches the parent tool part.
    if (event.parent_tool_use_id) {
        return [];
    }
    const changed: number[] = [];
    if (event.type === 'assistant') {
        for (const block of contentBlocks(event)) {
            const part = assistantBlockToPart(block);
            if (part) {
                changed.push(parts.push(part) - 1);
            }
        }
    }
    if (event.type === 'user') {
        for (const block of contentBlocks(event)) {
            if (block.type === 'text' && block.text?.startsWith(STOP_HOOK_FEEDBACK)) {
                changed.push(parts.push({ ...STOP_HOOK_PART }) - 1);
                continue;
            }
            const index = block.type === 'tool_result' ? applyToolResult(parts, block) : null;
            if (index !== null) {
                changed.push(index);
            }
        }
    }
    return changed;
}
