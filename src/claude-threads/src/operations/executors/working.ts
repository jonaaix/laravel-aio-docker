/**
 * Working Executor - owns the per-turn "working" post.
 *
 * Working content (tool calls, thinking, tool-result status) is routed here
 * instead of into the real-answer post, so the answer stays clean and the
 * working noise lives in its own post tagged `kind: 'working'`. That tag lets
 * history/delta read-back filter it out (peers see only real messages), and
 * the display mode lets a bot hide/collapse the block entirely.
 *
 * Display modes (per bot, `PlatformInstanceConfig.workingBlock`):
 * - `'expanded'` (default): a live blockquote listing the entries.
 * - `'hidden'`: no entries — just a minimal live "🛠️ Working…" placeholder that
 *   updates while tools run and is deleted at turn end (the answer is separate).
 *
 * One working post per turn: created on the first working entry, edited live,
 * and finalized at the turn's `result` flush so the next turn opens a fresh one.
 */

import type { WorkingBlockMode } from '../../config/types.js';
import { DEFAULT_WORKING_BLOCK_MODE } from '../../config/types.js';
import type { AppendContentOp, FlushOp } from '../types.js';
import type { ExecutorContext } from './types.js';
import { BaseExecutor, type ExecutorOptions } from './base.js';

export interface WorkingExecutorOptions extends ExecutorOptions {
  /** How the working block is displayed. Default `'expanded'`. */
  mode?: WorkingBlockMode;
}

interface WorkingState {
  /** The current turn's working post being edited (null → none yet this turn). */
  postId: string | null;
  /** Accumulated working entries for this turn (newline-joined). */
  content: string;
  /** Number of working entries this turn (for the hidden-mode indicator). */
  steps: number;
  /** Last body written to the post — skip redundant edits. */
  lastRendered: string;
}

export class WorkingExecutor extends BaseExecutor<WorkingState> {
  private readonly mode: WorkingBlockMode;

  constructor(options: WorkingExecutorOptions) {
    super(options, WorkingExecutor.createInitialState());
    this.mode = options.mode ?? DEFAULT_WORKING_BLOCK_MODE;
  }

  private static createInitialState(): WorkingState {
    return { postId: null, content: '', steps: 0, lastRendered: '' };
  }

  protected getInitialState(): WorkingState {
    return WorkingExecutor.createInitialState();
  }

  /** Accumulate one working entry (a tool line, thinking preview, or status). */
  async executeAppend(op: AppendContentOp, _ctx: ExecutorContext): Promise<void> {
    const entry = op.content.trim();
    if (!entry) return;
    this.state.content = this.state.content ? `${this.state.content}\n${entry}` : entry;
    this.state.steps += 1;
  }

  async executeFlush(_op: FlushOp, ctx: ExecutorContext): Promise<void> {
    await this.flush(ctx);
  }

  /** Create or update the working post with the accumulated entries. */
  async flush(ctx: ExecutorContext): Promise<void> {
    if (!this.state.content.trim()) return;
    const body = this.mode === 'hidden' ? this.renderHidden(ctx) : this.renderExpanded(ctx);
    if (body === this.state.lastRendered) return;
    try {
      if (this.state.postId) {
        await ctx.platform.updatePost(this.state.postId, body, { kind: 'working' });
      } else {
        const post = await ctx.createPost(body, { type: 'working' });
        this.state.postId = post.id;
      }
      this.state.lastRendered = body;
    } catch (err) {
      ctx.logger.warn(`working post flush failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * End the current turn's working post: in `expanded` mode it stays in the
   * thread (stop editing); in `hidden` mode the placeholder was only a progress
   * indicator, so delete it now that the turn is done. Either way the next turn
   * opens a fresh working post. Called at the `result` flush.
   */
  async finalizeTurn(ctx: ExecutorContext): Promise<void> {
    if (this.mode === 'hidden' && this.state.postId) {
      try {
        await ctx.platform.deletePost(this.state.postId);
      } catch (err) {
        ctx.logger.warn(`working placeholder delete failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    this.state = WorkingExecutor.createInitialState();
  }

  /** Minimal live placeholder for hidden mode: "🛠️ Working… (N steps)". */
  private renderHidden(ctx: ExecutorContext): string {
    const n = this.state.steps;
    return ctx.formatter.formatItalic(`🛠️ Working… (${n} step${n === 1 ? '' : 's'})`);
  }

  /**
   * Render the working block as a blockquote so the whole thing visually sets
   * itself apart from real messages while markdown inside (bold/code/emoji)
   * still renders — unlike a code fence. Tail-capped (recent steps matter more).
   */
  private renderExpanded(ctx: ExecutorContext): string {
    const header = ctx.formatter.formatBold('🛠️ Working');
    // A short, light rule. En-dashes render thinner than a solid rule and,
    // unlike a markdown `---`, are unambiguous inside a blockquote (a `---`
    // there reads as a heading/hr). Kept roughly header-width.
    const rule = '–'.repeat(12);
    // Separate the header from the author row ABOVE it (the blockquote otherwise
    // starts flush against the bot name) and from the first entry below, by
    // framing it with a rule on each side. A blank quote line can't do this:
    // Mattermost trims whitespace-only quote lines and a zero-width space counts
    // as whitespace, so it collapses (tried; the header stayed flush). A visible
    // rule is the reliable alternative and reads as a section title.
    const { maxLength } = ctx.platform.getMessageLimits();
    const marker = ctx.formatter.formatItalic('… (earlier steps omitted)');
    // Budget for the raw body; leave a margin for the header + both rules +
    // per-line "> " blockquote prefixes.
    const budget = maxLength - header.length - rule.length * 2 - marker.length - 200;
    const prefix: string[] = [rule, header, rule];
    let body = this.state.content;
    if (budget > 0 && body.length > budget) {
      body = body.slice(body.length - budget);
      prefix.push(marker);
    }
    return [...prefix, ...body.split('\n')]
      .map(line => ctx.formatter.formatBlockquote(line))
      .join('\n');
  }
}
