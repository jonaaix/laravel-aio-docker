/**
 * opencode agent backend.
 *
 * Implements the same `AgentBackend` surface as `ClaudeCli`, so the session
 * layer drives it identically (`start` → `sendMessage` → events → `kill`). The
 * differences from Claude are hidden here:
 *
 *  - There is no per-session child process. `start()` ensures the shared
 *    shared `opencodeServer` is up and creates (or resumes) an opencode
 *    session, then opens its OWN SSE subscription filtered to that session.
 *  - Incoming opencode events are translated into Claude-shaped events by a
 *    per-session `OpencodeEventTranslator` and re-emitted as `'event'`, so the
 *    downstream pipeline is unchanged.
 *  - Prompts go out via `session.promptAsync` (fire-and-forget); the assistant's
 *    output — and any error — comes back over SSE, not as the call's result.
 *  - `interrupt()`/`kill()` use opencode's `session.abort` endpoint instead of
 *    POSIX signals.
 *
 * First-cut simplifications (tracked for follow-up): no rate-limit routing, no
 * statusline/context snapshot, no permanent-failure classification, and the
 * permission flow is whatever the opencode server is configured to do.
 */

import { EventEmitter } from 'events';
import type { Event } from '@opencode-ai/sdk';
import type { AgentBackend } from '../agent/backend.js';
import { OpencodeEventTranslator } from './event-translator.js';
import { opencodeServer } from './server.js';
import type { OpencodeSessionStream } from './event-stream.js';
import { evaluateWriteScope, ensurePermissionConfig } from './write-scope.js';
import { opencodeMcpHost, type OpencodeMcpPlatformConfig } from '../mcp/opencode-mcp-host.js';
import { createLogger } from '../utils/logger.js';

/** A concrete opencode model selection, as the SDK's prompt body expects it. */
export interface OpencodeModel {
  providerID: string;
  modelID: string;
}

/**
 * Parse an opencode model spec in opencode's own `provider/model` notation
 * (the same value used in `opencode.json`, e.g. `anthropic/claude-sonnet-4-5`
 * or `openrouter/anthropic/claude-3.5-sonnet`) into `{ providerID, modelID }`.
 *
 * Split on the FIRST `/` so the provider is the leading segment and the model
 * id keeps any remaining slashes (openrouter-style nested ids). Returns
 * undefined for an empty/omitted spec or one without a usable `provider/model`
 * shape — the caller then leaves `model` unset and opencode falls back to its
 * own default (`opencode.json`).
 */
export function parseOpencodeModel(spec: string | undefined): OpencodeModel | undefined {
  if (!spec) return undefined;
  const trimmed = spec.trim();
  const slash = trimmed.indexOf('/');
  if (slash <= 0 || slash === trimmed.length - 1) return undefined;
  return { providerID: trimmed.slice(0, slash), modelID: trimmed.slice(slash + 1) };
}

export interface OpencodeAgentOptions {
  /** Working directory the opencode session operates in. */
  workingDir: string;
  /** Session id for log routing (platformId:threadId). */
  logSessionId?: string;
  /** Extra system prompt appended to each turn (thread context, etc.). */
  appendSystemPrompt?: string;
  /**
   * Existing opencode session id to resume instead of creating a new one.
   * Set on resume-after-restart; the id is persisted by the session store.
   */
  opencodeSessionId?: string;
  /** Human-readable session title shown in opencode. */
  title?: string;
  /**
   * Model to use for this session, overriding opencode's own default. Passed on
   * every turn's prompt body. Undefined → opencode picks the model from its own
   * config (`opencode.json`).
   */
  model?: OpencodeModel;
  /**
   * Directories this bot may WRITE in (`writeScope: 'workingDir'` → the
   * session's workingDir + OS tmp). Undefined → unrestricted: every permission
   * request is auto-approved (historic behavior). When set, write/bash
   * permission requests are evaluated against these dirs and rejected outside
   * them — see `write-scope.ts`.
   */
  writeScopeDirs?: string[];
  /**
   * Wiring for the in-process claude-threads MCP tools (send_file, read_post).
   * When set, the agent registers a per-session remote MCP with opencode
   * pointing at the bridge's in-process host, so the bot can post files and
   * read permalinks — the same tools the Claude backend gets via its stdio MCP
   * child, but with zero extra processes. Undefined → no MCP tools (older
   * behavior). See `opencode-mcp-host.ts`.
   */
  mcp?: {
    platform: OpencodeMcpPlatformConfig;
    /** Platform thread root that `send_file` posts into. */
    threadId: string;
    allowedRoots: string[];
    outboundEnabled: boolean;
    maxBytes: number;
    /** Session owner (send_dm attribution). */
    sessionOwnerUsername: string;
    /** Timeout for send_dm's per-recipient permission prompt. */
    promptTimeoutMs: number;
  };
}

export class OpencodeAgent extends EventEmitter implements AgentBackend {
  private readonly translator = new OpencodeEventTranslator();
  private readonly log: ReturnType<typeof createLogger>;
  /** opencode session id (created or resumed); set once `init()` resolves. */
  private sessionId: string | undefined;
  /** This session's own SSE subscription (isolated, self-healing). */
  private stream: OpencodeSessionStream | null = null;
  /** Resolves when the session exists and we're subscribed; rejects on failure. */
  private ready: Promise<void> | null = null;
  private alive = false;
  private exited = false;
  /** Name + token of this session's registered in-process MCP, for teardown. */
  private mcpRegistration: { name: string; token: string } | null = null;
  private failureReason: string | null = null;

  constructor(private readonly options: OpencodeAgentOptions) {
    super();
    this.log = createLogger('opencode').forSession(options.logSessionId ?? 'opencode');
  }

  /** The opencode session id, for persistence. Undefined until started. */
  getOpencodeSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Resolve once the session exists (created or resumed) so callers can read
   * `getOpencodeSessionId()` for persistence. Never rejects — an init failure
   * is surfaced separately via the `'error'`/`'exit'` events.
   */
  async whenReady(): Promise<void> {
    try {
      await this.ready;
    } catch {
      /* init failure already surfaced via events */
    }
  }

  start(): void {
    if (this.alive) throw new Error('Already running');
    this.alive = true;
    this.exited = false;
    this.ready = this.init().catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      this.failureReason = `opencode session could not be started: ${error.message}`;
      this.log.error(this.failureReason);
      this.emit('error', error);
      this.emitExit(1);
      throw error;
    });
  }

  private async init(): Promise<void> {
    // Pin edit/bash permissions in the working dir's opencode.json (an
    // unconfigured project otherwise wouldn't let the bot write at all).
    //  - confined to the working dir (the DEFAULT, and `writeScope: workingDir`)
    //    → 'ask', so opencode asks and the bridge approves in-dir writes and
    //    rejects the rest.
    //  - unrestricted (`writeScope: unrestricted`) → 'allow', write anywhere.
    // writeScopeDirs is set for the confined case, undefined for unrestricted.
    const permValue = this.options.writeScopeDirs ? 'ask' : 'allow';
    const result = ensurePermissionConfig(this.options.workingDir, permValue);
    if (result === 'created' || result === 'updated') {
      this.log.info(`opencode.json: set permission.edit/bash = "${permValue}" in ${this.options.workingDir}`);
    } else if (result === 'failed') {
      this.log.warn(`could not write ${this.options.workingDir}/opencode.json — edit/bash permissions may not apply`);
    }

    const client = await opencodeServer.ensureStarted();

    if (this.options.opencodeSessionId) {
      this.sessionId = this.options.opencodeSessionId;
      this.log.debug(`Resuming opencode session ${this.sessionId}`);
    } else {
      const { data, error } = await client.session.create({
        query: { directory: this.options.workingDir },
        body: { title: this.options.title ?? 'claude-threads session' },
      });
      if (error || !data) {
        throw new Error(`session.create failed: ${JSON.stringify(error ?? 'no data')}`);
      }
      this.sessionId = data.id;
      this.log.debug(`Created opencode session ${this.sessionId}`);
    }

    // Open THIS session's own event subscription and wait for it to be live
    // before init resolves — so the first prompt never races a dead stream.
    this.stream = opencodeServer.openStream(
      this.sessionId,
      this.options.workingDir,
      (event) => this.onOpencodeEvent(event),
      this.log,
    );
    await this.stream.start();

    await this.registerMcpTools(client);
  }

  /**
   * Give this session the claude-threads MCP tools (send_file, read_post) by
   * registering the bridge's in-process host as a per-session REMOTE MCP with
   * opencode. Best-effort: a failure here only costs the tools, never the
   * session. Torn down in kill().
   */
  private async registerMcpTools(client: NonNullable<typeof opencodeServer.client>): Promise<void> {
    if (!this.options.mcp || !this.sessionId) return;
    try {
      const { url, token } = await opencodeMcpHost.registerSession({
        platform: this.options.mcp.platform,
        threadId: this.options.mcp.threadId,
        allowedRoots: this.options.mcp.allowedRoots,
        outboundEnabled: this.options.mcp.outboundEnabled,
        maxBytes: this.options.mcp.maxBytes,
        sessionOwnerUsername: this.options.mcp.sessionOwnerUsername,
        promptTimeoutMs: this.options.mcp.promptTimeoutMs,
      });
      const name = `claude-threads-${this.sessionId}`;
      const { error } = await client.mcp.add({
        body: { name, config: { type: 'remote', url, enabled: true } },
        query: { directory: this.options.workingDir },
      });
      if (error) {
        opencodeMcpHost.unregisterSession(token);
        this.log.warn(`MCP tools registration failed: ${JSON.stringify(error)}`);
        return;
      }
      this.mcpRegistration = { name, token };
      this.log.debug(`registered in-process MCP tools as ${name}`);
    } catch (err) {
      this.log.warn(`MCP tools registration error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Tear down this session's MCP registration (disconnect + drop host entry). */
  private async teardownMcpTools(): Promise<void> {
    const reg = this.mcpRegistration;
    if (!reg) return;
    this.mcpRegistration = null;
    try {
      await opencodeServer.client?.mcp.disconnect({
        path: { name: reg.name },
        query: { directory: this.options.workingDir },
      });
    } catch (err) {
      this.log.debug(`MCP disconnect failed (ignored): ${err}`);
    }
    opencodeMcpHost.unregisterSession(reg.token);
  }

  private onOpencodeEvent(event: Event): void {
    // Permission requests (opencode surfaces them as `permission.updated`;
    // without a reply the tool hangs):
    //  - unrestricted (no writeScopeDirs): auto-approve everything — mirrors
    //    Claude's "bypass" mode. Operators who want prompting configure it in
    //    opencode. Wiring these to the thread's reaction-based approval UI
    //    (like the Claude MCP permission flow) is still deferred.
    //  - scoped (writeScopeDirs set): approve only writes inside the scope,
    //    reject everything else — keeps advisory bots out of peers' projects.
    // opencode 1.18 emits `permission.updated`; 1.17 named it `permission.asked`
    // (verified live) — handle both so a permission never hangs unanswered.
    const type = (event as { type?: string }).type;
    if (type === 'permission.updated' || type === 'permission.asked') {
      void this.answerPermission((event as unknown as { properties: Record<string, unknown> }).properties);
      return;
    }
    for (const translated of this.translator.translate(event)) {
      this.emit('event', translated);
    }
  }

  private async answerPermission(raw: Record<string, unknown>): Promise<void> {
    const client = opencodeServer.client;
    if (!client || !this.sessionId) return;
    // Normalize across opencode versions: 1.18 has {type, pattern, title};
    // 1.17 had {permission, patterns} and no title. The target path lives in
    // metadata either way (verified: metadata.filepath).
    const permission = {
      id: String(raw.id ?? ''),
      type: String(raw.type ?? raw.permission ?? ''),
      title: typeof raw.title === 'string' ? raw.title : undefined,
      pattern: (raw.pattern ?? raw.patterns) as string | string[] | undefined,
      metadata: (raw.metadata ?? {}) as Record<string, unknown>,
    };
    if (!permission.id) return;
    const scope = this.options.writeScopeDirs;
    // Scoped allows use 'once' (each request re-evaluated), not 'always'
    // (which would let opencode remember a blanket approval for the pattern).
    const response = !scope
      ? ('always' as const)
      : evaluateWriteScope(permission, scope) === 'allow'
        ? ('once' as const)
        : ('reject' as const);
    if (response === 'reject') {
      this.log.info(`write-scope: rejected permission "${permission.title ?? permission.id}" (type=${permission.type})`);
    }
    try {
      await client.postSessionIdPermissionsPermissionId({
        path: { id: this.sessionId, permissionID: permission.id },
        query: { directory: this.options.workingDir },
        body: { response },
      });
    } catch (err) {
      this.log.debug(`permission reply ${permission.id} failed: ${err}`);
    }
  }

  sendMessage(content: string): void {
    if (!this.ready) throw new Error('Not running');
    void this.ready.then(
      () => this.prompt(content),
      () => {
        // init() already surfaced the failure via 'error' + 'exit'.
      },
    );
  }

  private async prompt(content: string): Promise<void> {
    const client = opencodeServer.client;
    if (!client || !this.sessionId || !this.alive) return;
    let failure: string | null = null;
    try {
      const { error } = await client.session.promptAsync({
        path: { id: this.sessionId },
        query: { directory: this.options.workingDir },
        body: {
          parts: [{ type: 'text', text: content }],
          ...(this.options.appendSystemPrompt ? { system: this.options.appendSystemPrompt } : {}),
          ...(this.options.model ? { model: this.options.model } : {}),
        },
      });
      // A returned error means kicking off the turn failed outright (e.g. no
      // model configured). Turn-time failures arrive as session.error via SSE.
      if (error) failure = JSON.stringify(error);
    } catch (err) {
      // Thrown (network-level / SDK) failure — MUST be surfaced too, or the
      // turn dies silently and the thread just never answers.
      failure = err instanceof Error ? err.message : String(err);
    }
    if (failure) {
      this.log.error(`promptAsync failed: ${failure}`);
      this.emit('event', {
        type: 'assistant',
        message: { content: [{ type: 'text', text: `⚠️ opencode could not start the turn: ${failure}` }] },
      });
      this.emit('event', { type: 'result', subtype: 'error_during_execution', is_error: true, result: {} });
    }
  }

  interrupt(): boolean {
    if (!this.alive || !this.sessionId) return false;
    const client = opencodeServer.client;
    if (!client) return false;
    this.log.debug(`Aborting opencode session ${this.sessionId} (interrupt)`);
    void client.session.abort({ path: { id: this.sessionId }, query: { directory: this.options.workingDir } }).catch(() => {});
    return true;
  }

  async kill(): Promise<void> {
    if (!this.alive) return;
    this.alive = false;
    this.stream?.stop();
    this.stream = null;
    // Disconnect the MCP registration first (runs on !stop, !pause, timeout,
    // shutdown) so a paused/ended session never leaves its tools visible to a
    // sibling session of the same bot.
    await this.teardownMcpTools();
    if (this.sessionId) {
      const client = opencodeServer.client;
      try {
        await client?.session.abort({ path: { id: this.sessionId }, query: { directory: this.options.workingDir } });
      } catch (err) {
        this.log.debug(`abort during kill failed (ignored): ${err}`);
      }
    }
    this.emitExit(0);
  }

  isRunning(): boolean {
    return this.alive;
  }

  isPermanentFailure(): boolean {
    return this.failureReason !== null;
  }

  getPermanentFailureReason(): string | null {
    return this.failureReason;
  }

  getStatusData(): null {
    // opencode has no statusline equivalent yet; context/usage is surfaced via
    // the result event's usage instead.
    return null;
  }

  /** Emit `exit` at most once (kill and init-failure can both reach here). */
  private emitExit(code: number): void {
    if (this.exited) return;
    this.exited = true;
    this.alive = false;
    this.emit('exit', code);
  }
}
