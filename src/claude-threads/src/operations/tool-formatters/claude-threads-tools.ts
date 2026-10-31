/**
 * claude-threads MCP tool formatters
 *
 * Formatters for the bridge's own MCP tools (server `claude-threads-mcp`).
 *
 * - react_to_post: hidden. The reaction already shows up as an emoji ON the
 *   user's message, so the generic "🔌 react_to_post (claude-threads-mcp)"
 *   tool-use line is pure noise in the thread.
 */

import type { ToolFormatter, ToolFormatResult, ToolInput } from './types.js';

export const claudeThreadsToolsFormatter: ToolFormatter = {
  toolNames: ['mcp__claude-threads-mcp__react_to_post'],

  format(_toolName: string, _input: ToolInput): ToolFormatResult | null {
    // Reaction is visible on the message itself → don't log the tool use.
    return { display: null, hidden: true };
  },
};
