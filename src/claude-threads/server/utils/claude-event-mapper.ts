import type { ClaudeEvent } from '../../src/claude/cli';
import type { ChatPart } from '../../shared/types/conversation';

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

// Full tool output stays in Claude's own transcript; the chat history only keeps what is worth showing.
const MAX_TOOL_OUTPUT_CHARS = 64_000;

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
      const index = block.type === 'tool_result' ? applyToolResult(parts, block) : null;
      if (index !== null) {
        changed.push(index);
      }
    }
  }
  return changed;
}
