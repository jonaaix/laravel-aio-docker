/**
 * Task-related tool formatters
 *
 * Handles tools that affect task/workflow state:
 * - TodoWrite: Task list management (hidden, handled specially)
 * - Task: Subagent spawning (hidden, handled specially)
 * - EnterPlanMode: Plan mode entry
 * - ExitPlanMode: Plan approval (hidden, handled specially)
 * - AskUserQuestion: User questions (hidden, handled specially)
 */

import type { ToolFormatter, ToolFormatResult, ToolInput, ToolFormatOptions } from './types.js';

// ---------------------------------------------------------------------------
// Task Tools Formatter
// ---------------------------------------------------------------------------

/**
 * Formatter for task-related tools.
 */
export const taskToolsFormatter: ToolFormatter = {
  toolNames: [
    'TodoWrite',
    'TaskCreate',
    'TaskUpdate',
    'TaskGet',
    'TaskList',
    'Task',
    'EnterPlanMode',
    'ExitPlanMode',
    'AskUserQuestion',
  ],

  format(toolName: string, input: ToolInput, options: ToolFormatOptions): ToolFormatResult | null {
    const { formatter } = options;

    switch (toolName) {
      case 'TodoWrite':
      case 'TaskCreate':
      case 'TaskUpdate':
        // Hidden - handled specially with task list display
        return { display: null, hidden: true };

      case 'TaskGet':
      case 'TaskList':
        return { display: null, hidden: true };

      case 'Task':
        // Hidden - handled specially with subagent display
        return { display: null, hidden: true };

      case 'EnterPlanMode':
        return {
          display: `📋 ${formatter.formatBold('Planning...')}`,
          permissionText: `📋 ${formatter.formatBold('Planning...')}`,
        };

      case 'ExitPlanMode': {
        // Hidden - handled specially with approval buttons
        const preview = planPreview(typeof input.plan === 'string' ? input.plan : '');
        const header = `📋 ${formatter.formatBold('Plan approval requested')}`;
        return {
          display: null,
          hidden: true,
          permissionText: preview ? `${header}\n\n${preview}` : header,
        };
      }

      case 'AskUserQuestion':
        // Hidden - the question text follows separately
        return { display: null, hidden: true };

      default:
        return null;
    }
  },
};

const PLAN_PREVIEW_MAX_CODE_POINTS = 1500;

function planPreview(plan: string): string {
  const points = Array.from(plan);
  if (points.length <= PLAN_PREVIEW_MAX_CODE_POINTS) return plan;
  const preview = `${points.slice(0, PLAN_PREVIEW_MAX_CODE_POINTS).join('')}\n…`;
  const fenceCount = (preview.match(/^```/gm) || []).length;
  return fenceCount % 2 === 1 ? `${preview}\n\`\`\`` : preview;
}
