/**
 * Agent backend abstraction.
 *
 * claude-threads was originally built around a single agent process: the
 * Claude Code CLI (`src/claude/cli.ts`). To support alternative agent backends
 * (e.g. opencode) without rewriting the session/transformer/executor layers,
 * we type `Session.claude` against this interface instead of the concrete
 * `ClaudeCli` class. Every backend emits the same events and exposes the same
 * control surface; the differences (process vs. HTTP+SSE, permission model,
 * resume semantics) live entirely inside each implementation.
 *
 * The canonical event payload is still the Claude stream-json event shape
 * (`AgentEvent`), because the whole downstream pipeline — `transformer.ts`,
 * the executors, the streaming handler — already consumes it. A non-Claude
 * backend is responsible for translating its native events into this shape
 * before emitting them (see `src/opencode/`). This keeps the abstraction seam
 * narrow: one interface here, one translator per backend.
 *
 * Field-name note: `Session.claude` keeps its historical name even when it
 * holds a non-Claude backend, to avoid a wide mechanical rename across the
 * codebase. Read it as "the session's agent".
 */

// The event payload and status shapes remain the Claude-shaped types the
// downstream pipeline already understands. Re-exported under backend-neutral
// aliases so backend code doesn't have to import "Claude" names directly.
export type { ClaudeEvent as AgentEvent, StatusLineData as AgentStatusData } from '../claude/cli.js';
export type { RateLimitHit } from '../claude/rate-limit-detector.js';

import type { ClaudeEvent, StatusLineData } from '../claude/cli.js';
import type { RateLimitHit } from '../claude/rate-limit-detector.js';

// Which agent backend a session runs on. Canonical definition lives in
// config/types.ts (it's a config concept); re-exported here so backend code can
// import it alongside the rest of the agent abstraction.
export type { AgentBackendKind } from '../config/types.js';
export { DEFAULT_AGENT_BACKEND } from '../config/types.js';

/**
 * Events every agent backend emits. Documented here as the contract; the
 * concrete `on()` overloads live on the interface below.
 *
 * - `event`      — one agent event (Claude stream-json shape). The primary
 *                  channel that drives all visible output.
 * - `exit`       — the underlying agent stopped; `code` is a best-effort exit
 *                  status (0 for clean, non-zero for crash). Typed `number` to
 *                  match the existing `handleExit` contract across the session
 *                  layer; backends normalize a missing code to 0.
 * - `rate-limit` — the backend detected an upstream rate limit; the session
 *                  layer routes this to account cooldown (Claude only today).
 * - `error`      — a fatal error starting or running the backend.
 * - `status`     — updated context/usage snapshot (Claude statusline today;
 *                  other backends may never emit it).
 */
export interface AgentBackendEvents {
  event: (event: ClaudeEvent) => void;
  exit: (code: number) => void;
  'rate-limit': (hit: RateLimitHit) => void;
  error: (err: Error) => void;
  status: (data: StatusLineData) => void;
}

/**
 * The control + observation surface the session layer depends on. Both
 * `ClaudeCli` and `OpencodeAgent` implement this. Kept intentionally minimal:
 * only what `src/session/**` and `src/operations/**` actually call today.
 */
export interface AgentBackend {
  /** Start the agent (spawn process / create session + subscribe). */
  start(): void;

  /** Send a user turn to the agent. */
  sendMessage(content: string): void;

  /**
   * Terminate the agent for good. Resolves once it has fully stopped so
   * callers can safely tear down session state afterwards.
   */
  kill(): Promise<void>;

  /**
   * Interrupt the current turn without killing the agent (like Escape).
   * Returns false when there was nothing running to interrupt.
   */
  interrupt(): boolean;

  /** Whether the agent is currently alive. */
  isRunning(): boolean;

  /**
   * Whether the last failure is permanent (won't be fixed by retry/resume),
   * so the session layer can surface it instead of looping. Backends with no
   * such class of error return false.
   */
  isPermanentFailure(): boolean;

  /** Human-readable reason for a permanent failure, or null when none. */
  getPermanentFailureReason(): string | null;

  /**
   * The OS signal that terminated the agent on its last exit, or null/undefined
   * when it exited with a normal status code (or the backend has no process).
   * Optional: process-less backends (opencode) need not implement it. Used to
   * explain an "exit code null" — code is null exactly when a signal killed it.
   */
  getLastExitSignal?(): NodeJS.Signals | null;

  /**
   * Latest context/usage snapshot, or null when unavailable. Claude sources
   * this from its statusline hook; other backends may always return null.
   */
  getStatusData(): StatusLineData | null;

  // EventEmitter surface consumed by the session layer. Typed against the
  // known events; the generic overload keeps structural compatibility with
  // Node's EventEmitter (which both implementations extend).
  on<E extends keyof AgentBackendEvents>(event: E, listener: AgentBackendEvents[E]): this;
  on(event: string | symbol, listener: (...args: unknown[]) => void): this;
}
