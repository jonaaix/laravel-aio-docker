/**
 * opencode → Claude event translator.
 *
 * opencode speaks a different event language than the Claude Code CLI: a single
 * SSE stream of `message.part.updated` / `todo.updated` / `session.idle` events
 * (see `@opencode-ai/sdk`), where text parts stream token-by-token (same part
 * id, growing `text` + a `delta`). The rest of claude-threads — `transformer.ts`
 * and the executors — consumes the Claude stream-json shape instead.
 *
 * This module bridges the two. It is intentionally the ONLY place that knows
 * opencode's native event shapes; everything downstream keeps seeing Claude
 * events. Given the two models, the translator is necessarily **stateful**:
 *
 *   1. **De-duplication.** opencode re-emits a text part on every token. The
 *      Claude pipeline appends whatever it's handed, so emitting per-token would
 *      duplicate text. We instead track parts by id and emit each text/reasoning
 *      segment exactly once.
 *
 *   2. **Segment-granular streaming, not token-granular.** The content executor
 *      concatenates appends and inserts a `\n\n` separator (and trims) between
 *      flushes to an existing post. That is correct for Claude, which emits one
 *      complete text block per `assistant` event, but would shred a token stream
 *      into ragged paragraphs. So we emit a text/reasoning part when it
 *      *completes* (`time.end` set) — or at `session.idle` as a backstop — which
 *      reproduces Claude's "one complete block per event" contract. opencode
 *      opens a fresh text part after each tool call, so this still streams at
 *      paragraph/segment granularity, not just once at the end. (Token-level
 *      streaming would require executor changes and is deliberately out of
 *      scope for the first cut.)
 *
 * Tool display: rather than remap every opencode tool's input schema onto the
 * Claude tool formatters (fragile, version-dependent), we use opencode's own
 * human-readable `state.title` as the tool name. The registry's generic
 * fallback then renders `● **<title>**` — always correct, if less rich than
 * Claude's native diff/preview formatters. Enriching specific tools can come
 * later.
 *
 * The translator is per-session: the agent filters the global SSE stream by
 * `sessionID` before handing events here, so this class assumes every event
 * belongs to its session.
 */

import type { Event, Todo } from '@opencode-ai/sdk';
import type { AgentEvent } from '../agent/backend.js';

/**
 * Local aliases for the deeply-nested opencode SDK event property types. The
 * SDK exposes these only inside the `Event` union; extracting them here keeps
 * the method signatures readable without importing a dozen generated names.
 */
type PartUpdatedPart = Extract<Event, { type: 'message.part.updated' }>['properties']['part'];
type ToolPart = Extract<PartUpdatedPart, { type: 'tool' }>;
type MessageUpdatedInfo = Extract<Event, { type: 'message.updated' }>['properties']['info'];
type SessionErrorError = Extract<Event, { type: 'session.error' }>['properties']['error'];

/** opencode tool names whose output we surface via `todo.updated`, not as a tool row. */
const TODO_TOOL_NAMES = new Set(['todowrite', 'todoread', 'todo']);

/** Tracked state for a streaming text/reasoning part. */
interface TrackedTextPart {
  kind: 'text' | 'reasoning';
  text: string;
  /** Owning message id — used to check the message's role before emitting. */
  messageID: string;
}

export class OpencodeEventTranslator {
  /** Latest text of each streaming text/reasoning part, by part id, in arrival order. */
  private readonly textParts = new Map<string, TrackedTextPart>();
  /**
   * Role of each message by id, learned from `message.updated`. opencode emits
   * `message.part.updated` for BOTH the user's prompt and the assistant's
   * reply; without this we'd echo the user's own message back as assistant
   * text. We only emit text/reasoning for messages known to be `assistant`.
   */
  private readonly messageRoles = new Map<string, string>();
  /** Part ids whose text/reasoning we've already emitted (dedupe). */
  private readonly emittedTextParts = new Set<string>();
  /** callIDs for which we've emitted a `tool_use`. */
  private readonly toolUseEmitted = new Set<string>();
  /** callIDs for which we've emitted a `tool_result`. */
  private readonly toolResultEmitted = new Set<string>();
  /**
   * Whether anything happened since the last emitted `result`. opencode can
   * close one turn several times in a burst (observed on abort: session.error,
   * then session.idle 2ms later, then ANOTHER idle after the aborted tool
   * parts finalize). Each `result` triggers a downstream flush/status cycle,
   * so stray turn-ends must be suppressed: an idle with no new activity since
   * the last result emits nothing. Starts true so a turn that produces no
   * events at all still closes on its first idle.
   */
  private activitySinceResult = true;

  /** Usage/cost from the most recent assistant message, for the `result` event. */
  private lastAssistant: {
    modelID?: string;
    cost?: number;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  } = {};

  /**
   * Translate one opencode event into zero or more Claude-shaped events.
   * Order within the returned array is significant and preserved by callers.
   */
  translate(event: Event): AgentEvent[] {
    switch (event.type) {
      case 'message.part.updated':
        this.activitySinceResult = true;
        return this.onPartUpdated(event.properties.part, event.properties.delta);
      case 'message.updated':
        this.activitySinceResult = true;
        this.onMessageUpdated(event.properties.info);
        return [];
      case 'todo.updated':
        this.activitySinceResult = true;
        return this.onTodoUpdated(event.properties.todos);
      case 'session.idle':
        return this.onIdle();
      case 'session.error':
        return this.onError(event.properties.error);
      default:
        return [];
    }
  }

  // -------------------------------------------------------------------------
  // Part updates (text / reasoning / tool)
  // -------------------------------------------------------------------------

  private onPartUpdated(part: PartUpdatedPart, _delta?: string): AgentEvent[] {
    switch (part.type) {
      case 'text':
        return this.onTextLikePart(part.id, 'text', part.text, part.messageID, part.time?.end);
      case 'reasoning':
        // Intentionally NOT surfaced. The Claude backend never shows its
        // reasoning in the thread, so opencode shouldn't either — otherwise the
        // model's raw chain-of-thought leaks as a "> 💭 …" quote (verbose and
        // inconsistent across backends). Only the answer (text parts) is shown.
        return [];
      case 'tool':
        return this.onToolPart(part);
      default:
        // file / step-start / snapshot / agent / etc. — not surfaced in the slice.
        return [];
    }
  }

  /**
   * Track a streaming text/reasoning part; emit it once, when it completes.
   * `end` is the part's `time.end` (present once opencode finalizes the part).
   * Emission is gated on the owning message being an assistant message (see
   * `messageRoles`); a part whose role isn't confirmed yet is emitted later by
   * the `session.idle` backstop, by which point the role is always known.
   */
  private onTextLikePart(
    id: string,
    kind: 'text' | 'reasoning',
    text: string,
    messageID: string,
    end: number | undefined,
  ): AgentEvent[] {
    this.textParts.set(id, { kind, text, messageID });
    if (end !== undefined && !this.emittedTextParts.has(id)) {
      return this.emitTextPart(id);
    }
    return [];
  }

  /**
   * Emit a tracked text/reasoning part as a Claude assistant event (once).
   * Returns [] (without marking emitted) when the owning message is not yet
   * confirmed as an assistant message, so the idle backstop can retry once the
   * role is known. Parts confirmed to belong to a user message are marked
   * emitted and dropped, so the user's own prompt is never echoed back.
   */
  private emitTextPart(id: string): AgentEvent[] {
    if (this.emittedTextParts.has(id)) return [];
    const tracked = this.textParts.get(id);
    if (!tracked) return [];
    const role = this.messageRoles.get(tracked.messageID);
    if (role !== 'assistant') {
      // Drop user (and any other non-assistant) message parts permanently;
      // hold unknown-role parts for the idle backstop to reconsider.
      if (role !== undefined) this.emittedTextParts.add(id);
      return [];
    }
    this.emittedTextParts.add(id);
    const text = tracked.text.trim();
    if (!text) return [];
    const block =
      tracked.kind === 'reasoning'
        ? { type: 'thinking', thinking: text }
        : { type: 'text', text };
    return [{ type: 'assistant', message: { content: [block] } } as AgentEvent];
  }

  private onToolPart(part: ToolPart): AgentEvent[] {
    const callID = part.callID;
    const state = part.state;
    const status = state.status;

    // Todos are surfaced via the todo.updated event as a live task list; don't
    // also render the todo tool as a plain tool row.
    if (TODO_TOOL_NAMES.has(part.tool.toLowerCase())) return [];

    const ops: AgentEvent[] = [];

    // Emit the tool_use once, as soon as it's actionable (running/completed/error).
    // `pending` has input but no title yet and may never run, so we wait.
    const actionable = status === 'running' || status === 'completed' || status === 'error';
    if (actionable && !this.toolUseEmitted.has(callID)) {
      this.toolUseEmitted.add(callID);
      const title = 'title' in state ? (state.title as string | undefined) : undefined;
      const input = 'input' in state ? (state.input as Record<string, unknown>) : {};
      ops.push({
        type: 'tool_use',
        tool_use: {
          id: callID,
          // For our own MCP tools, use the canonical Claude MCP name so the
          // shared tool formatters apply (react_to_post is hidden; the rest
          // render as "🔌 <tool> (claude-threads-mcp)") — otherwise opencode's
          // namespaced `claude-threads-<sessionId>_<tool>` misses the registry
          // and leaks as a raw name. Fall back to opencode's title / a
          // title-cased tool name for everything else.
          name: canonicalClaudeThreadsToolName(part.tool) ?? (title || prettyToolName(part.tool)),
          input: normalizeToolInput(input),
        },
      } as AgentEvent);
    }

    // Emit the tool_result once the tool finishes.
    if ((status === 'completed' || status === 'error') && !this.toolResultEmitted.has(callID)) {
      this.toolResultEmitted.add(callID);
      ops.push({
        type: 'tool_result',
        tool_result: { tool_use_id: callID, is_error: status === 'error' },
      } as AgentEvent);
    }

    return ops;
  }

  // -------------------------------------------------------------------------
  // Message usage / cost
  // -------------------------------------------------------------------------

  private onMessageUpdated(info: MessageUpdatedInfo): void {
    // Record every message's role so text/reasoning parts can be gated to
    // assistant messages only (opencode streams user-message parts too).
    this.messageRoles.set(info.id, info.role);
    if (info.role !== 'assistant') return;
    this.lastAssistant = {
      modelID: info.modelID,
      cost: info.cost,
      usage: {
        input_tokens: info.tokens?.input,
        output_tokens: info.tokens?.output,
        cache_read_input_tokens: info.tokens?.cache?.read,
        cache_creation_input_tokens: info.tokens?.cache?.write,
      },
    };
  }

  // -------------------------------------------------------------------------
  // Todos → synthetic TodoWrite
  // -------------------------------------------------------------------------

  private onTodoUpdated(todos: Todo[]): AgentEvent[] {
    // Reuse the Claude TodoWrite path: the transformer maps a TodoWrite tool_use
    // into a TaskListOp. opencode todos lack Claude's `activeForm`, so we derive
    // it from `content`, and fold the `cancelled` status (which the task-list UI
    // has no state for) into `completed`.
    const mapped = todos.map((t) => ({
      content: t.content,
      status: t.status === 'cancelled' ? 'completed' : t.status,
      activeForm: t.content,
    }));
    return [
      {
        type: 'tool_use',
        tool_use: { id: 'opencode-todos', name: 'TodoWrite', input: { todos: mapped } },
      } as AgentEvent,
    ];
  }

  // -------------------------------------------------------------------------
  // Turn end / error
  // -------------------------------------------------------------------------

  private onIdle(): AgentEvent[] {
    const ops: AgentEvent[] = [];
    // Backstop: flush any text/reasoning parts that never received a time.end
    // (in arrival order) so nothing is silently dropped at turn's end.
    for (const id of this.textParts.keys()) {
      if (!this.emittedTextParts.has(id)) {
        ops.push(...this.emitTextPart(id));
      }
    }
    // Stray idle: the turn was already closed (e.g. by session.error moments
    // ago) and nothing happened since — emitting another result would trigger
    // a redundant flush/status cycle downstream.
    if (ops.length === 0 && !this.activitySinceResult) return [];
    this.activitySinceResult = false;
    ops.push(this.resultEvent(false));
    return ops;
  }

  private onError(error: SessionErrorError): AgentEvent[] {
    const message = describeOpencodeError(error);
    const ops: AgentEvent[] = [];
    if (message) {
      ops.push({
        type: 'assistant',
        message: { content: [{ type: 'text', text: `⚠️ ${message}` }] },
      } as AgentEvent);
    }
    this.activitySinceResult = false;
    ops.push(this.resultEvent(true));
    return ops;
  }

  /** Build a Claude `result` event carrying the last assistant message's usage. */
  private resultEvent(isError: boolean): AgentEvent {
    return {
      type: 'result',
      subtype: isError ? 'error_during_execution' : 'success',
      is_error: isError,
      result: {
        model: this.lastAssistant.modelID,
        cost_usd: this.lastAssistant.cost,
        usage: this.lastAssistant.usage,
      },
    } as AgentEvent;
  }
}

/** Title-case a bare opencode tool name (`bash` → `Bash`) for the fallback label. */
function prettyToolName(tool: string): string {
  if (!tool) return 'Tool';
  return tool.charAt(0).toUpperCase() + tool.slice(1);
}

/** The claude-threads MCP tools the bridge exposes (see registerClaudeThreadsTools). */
const CLAUDE_THREADS_TOOLS = [
  'send_file', 'read_post', 'react_to_post', 'update_own_post',
  'list_thread', 'read_channel_history', 'search_messages', 'send_dm',
];

/**
 * opencode namespaces MCP tools as `<serverName>_<tool>`, and the bridge's
 * server is `claude-threads-<opencodeSessionId>` — so a call surfaces as e.g.
 * `claude-threads-ses_08…_react_to_post`. Rewrite that to the canonical Claude
 * name `mcp__claude-threads-mcp__<tool>` so the shared tool formatters match
 * (hiding react_to_post, prettifying the rest). Returns null for anything
 * that isn't one of our namespaced tools. The sessionId itself contains `_`,
 * so match by known tool SUFFIX rather than splitting on `_`.
 */
function canonicalClaudeThreadsToolName(tool: string): string | null {
  if (!tool.toLowerCase().startsWith('claude-threads-')) return null;
  const hit = CLAUDE_THREADS_TOOLS.find((t) => tool.endsWith(`_${t}`));
  return hit ? `mcp__claude-threads-mcp__${hit}` : null;
}

/**
 * opencode names some tool-input fields in camelCase where the Claude tool
 * formatters (shared with the Claude backend) read snake_case — e.g. opencode's
 * read/write/edit put the path in `filePath`, but the formatter reads
 * `file_path`, so the path rendered as empty backticks (`📄 Read \`\``). Add the
 * snake_case aliases (originals kept) so those formatters render the path/diff.
 * Fields that already match (`pattern`, `content`, `command`) need no alias.
 */
function normalizeToolInput(input: Record<string, unknown>): Record<string, unknown> {
  const aliases: Record<string, string> = {
    filePath: 'file_path',
    oldString: 'old_string',
    newString: 'new_string',
  };
  const out = { ...input };
  for (const [camel, snake] of Object.entries(aliases)) {
    if (out[camel] !== undefined && out[snake] === undefined) out[snake] = out[camel];
  }
  return out;
}

/** Best-effort human-readable string for an opencode session error payload. */
function describeOpencodeError(error: SessionErrorError): string {
  if (!error) return 'opencode reported an error';
  const e = error as { name?: string; data?: { message?: string } };
  return e.data?.message || e.name || 'opencode reported an error';
}
