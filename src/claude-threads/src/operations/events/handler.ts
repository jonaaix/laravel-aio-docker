/**
 * Claude event handling module
 *
 * Handles pre/post processing of Claude events, session-specific side effects,
 * and specialized features like compaction handling.
 *
 * NOTE: Main event handling (formatting, tool handling) is done by MessageManager.
 * This module handles session-specific side effects that wrap MessageManager.
 */

import type { Session, SessionUsageStats, ModelTokenUsage } from '../../session/types.js';
import { getSessionStatus, markClaudeResponded, clearBootAck } from '../../session/types.js';
import type { ClaudeEvent } from '../../claude/cli.js';
import { shortenPath } from '../index.js';
import { withErrorHandling } from '../../utils/error-handler/index.js';
import { resetSessionActivity, post, postError, updatePost } from '../post-helpers/index.js';
import type { SessionContext } from '../session-context/index.js';
import { createLogger } from '../../utils/logger.js';
import { createSessionLog } from '../../utils/session-log.js';
import { extractPullRequestUrl } from '../../utils/pr-detector.js';
import { changeDirectory, reportBug } from '../commands/index.js';
import { buildWorktreeListMessage } from '../worktree/index.js';
import { trackEvent } from '../bug-report/index.js';
import { parseClaudeCommand, removeCommandFromText, isClaudeAllowedCommand } from '../../commands/index.js';

const log = createLogger('events');
const sessionLog = createSessionLog(log);

// ---------------------------------------------------------------------------
// Claude command detection
// ---------------------------------------------------------------------------

/**
 * Detect and execute commands from Claude's assistant output.
 * Uses the shared command parser with Claude's allowlist.
 * Returns the text with the command removed (if executed), or original text.
 */
function detectAndExecuteClaudeCommands(
  text: string,
  session: Session,
  ctx: SessionContext
): string {
  const parsed = parseClaudeCommand(text);

  if (parsed && isClaudeAllowedCommand(parsed.command)) {
    sessionLog(session).info(`🤖 Claude executing !${parsed.command} ${parsed.args || ''}`);

    // Execute the command asynchronously
    executeClaudeCommand(session, parsed.command, parsed.args || '', ctx);

    // Remove the command from the displayed text
    return removeCommandFromText(text, parsed);
  }

  return text;
}

/**
 * Execute a command on behalf of Claude.
 * Posts a visibility message and runs the command.
 * For commands that produce output, sends the result back to Claude.
 *
 * Only commands in CLAUDE_ALLOWED_COMMANDS can be executed.
 */
async function executeClaudeCommand(
  session: Session,
  command: string,
  args: string,
  ctx: SessionContext
): Promise<void> {
  const formatter = session.platform.getFormatter();

  // Post visibility message so users can see what Claude is doing
  const worktreeContext = session.worktreeInfo
    ? { path: session.worktreeInfo.worktreePath, branch: session.worktreeInfo.branch }
    : undefined;
  const shortArgs = args ? shortenPath(args, undefined, worktreeContext) : '';
  const visibilityMessage = `🤖 ${formatter.formatBold('Claude executed:')} ${formatter.formatCode(`!${command}${shortArgs ? ' ' + shortArgs : ''}`)}`;

  await withErrorHandling(
    () => post(session, 'info', visibilityMessage),
    { action: 'Post Claude command visibility', session }
  );

  // Execute the command based on type
  switch (command) {
    case 'cd':
      // Use session owner's permissions
      // Note: This restarts Claude, so no result can be sent back
      await changeDirectory(session, args, session.startedBy, ctx);
      break;

    case 'worktree list': {
      // Get worktree list and send result back to Claude
      const message = await buildWorktreeListMessage(session);
      if (message === null) {
        await postError(session, `Current directory is not a git repository`);
        // Send error back to Claude too
        if (session.claude?.isRunning()) {
          session.claude.sendMessage(`<command-result command="!worktree list">\nError: Current directory is not a git repository\n</command-result>`);
        }
      } else {
        await post(session, 'info', message);
        // Send the result back to Claude so it can see the worktree list
        if (session.claude?.isRunning()) {
          // Use plain text version for Claude (strip markdown formatting for clarity)
          const plainMessage = message
            .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold
            .replace(/`([^`]+)`/g, '$1');       // Remove code formatting
          session.claude.sendMessage(`<command-result command="!worktree list">\n${plainMessage}\n</command-result>`);
          sessionLog(session).info(`📤 Sent worktree list result back to Claude`);
        }
      }
      break;
    }

    case 'bug':
      // Claude can report bugs it encounters
      await reportBug(session, args, session.startedBy, ctx);
      break;
  }
}

/**
 * Extract and update pull request URL from text.
 * Unlike title/description, PR URLs are detected from the actual content
 * (not from special markers), as Claude outputs them when running gh pr create.
 *
 * Only updates if we don't already have a PR URL (first one wins).
 */
function extractAndUpdatePullRequest(
  text: string,
  session: Session,
  ctx: SessionContext
): void {
  // Skip if we already have a PR URL
  if (session.pullRequestUrl) return;

  const prUrl = extractPullRequestUrl(text);
  if (prUrl) {
    session.pullRequestUrl = prUrl;
    sessionLog(session).info(`🔗 Detected PR URL: ${prUrl}`);

    // Persist and update UI
    ctx.ops.persistSession(session);
    ctx.ops.updateStickyMessage().catch(() => {});
    ctx.ops.updateSessionHeader(session).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Pre/Post Processing for MessageManager integration
// ---------------------------------------------------------------------------

function isSidechainEvent(event: ClaudeEvent): boolean {
  return Boolean((event as { parent_tool_use_id?: unknown }).parent_tool_use_id);
}

function contentBlocks(event: ClaudeEvent): Array<{ type: string; name?: string; is_error?: boolean }> {
  const content = (event.message as { content?: unknown } | undefined)?.content;
  return Array.isArray(content) ? content : [];
}

/**
 * Pre-processing for events when using MessageManager.
 * Handles session-specific side effects that should run BEFORE the main event handling.
 */
export function handleEventPreProcessing(
  session: Session,
  event: ClaudeEvent,
  ctx: SessionContext
): void {
  // Log raw event to thread logger (first thing, before any processing)
  session.threadLogger?.logEvent(event);

  // Reset activity and clear timeout tracking (prevents updating stale posts in long threads)
  resetSessionActivity(session);

  // On first meaningful response from Claude, mark session as safe to resume and persist
  if (!session.lifecycle.hasClaudeResponded && (event.type === 'assistant' || event.type === 'tool_use')) {
    markClaudeResponded(session);
    // The bot is visibly responding now — take the ⏳ boot ack off the
    // triggering message.
    clearBootAck(session);
    ctx.ops.persistSession(session);
    ctx.ops.emitSessionUpdate(session.sessionId, { status: getSessionStatus(session) });
  }

  // Handle system events specially
  if (event.type === 'system') {
    const e = event as ClaudeEvent & {
      subtype?: string;
      status?: string;
      compact_metadata?: unknown;
      compact_result?: string;
      compact_error?: string;
      slash_commands?: string[];
      mcp_servers?: Array<{ name?: string; status?: string }>;
    };

    if (e.subtype === 'init' && Array.isArray(e.mcp_servers)) {
      reportMcpServers(session, e.mcp_servers);
    }

    // Capture available slash commands from init event
    if (e.subtype === 'init' && e.slash_commands && Array.isArray(e.slash_commands)) {
      session.availableSlashCommands = new Set(
        e.slash_commands.map((cmd: string) =>
          cmd.startsWith('/') ? cmd.slice(1) : cmd
        )
      );
      sessionLog(session).info(
        `Captured ${session.availableSlashCommands.size} slash commands from init: ${[...session.availableSlashCommands].join(', ')}`
      );
    }

    // Handle compaction events
    if (e.subtype === 'status' && e.status === 'compacting') {
      handleCompactionStart(session, ctx);
    }
    if (e.subtype === 'status' && e.compact_result === 'failed') {
      void handleCompactionFailed(session, e.compact_error);
    }
    if (e.subtype === 'compact_boundary') {
      handleCompactionComplete(session, e.compact_metadata, ctx);
    }
  }

  if (event.type === 'auth_status') {
    handleAuthStatus(session, event as ClaudeEvent & { isAuthenticating?: boolean; output?: string[]; error?: string });
  }

  // Track tool use events for bug reporting context
  if (event.type === 'assistant' && !isSidechainEvent(event)) {
    for (const block of contentBlocks(event)) {
      if (block.type === 'tool_use' && block.name) {
        trackEvent(session, 'tool_use', block.name);
      }
    }
  }
  if (event.type === 'tool_use') {
    const tool = event.tool_use as { name: string };
    trackEvent(session, 'tool_use', tool.name);
  }
}

/**
 * Post-processing for events when using MessageManager.
 * Handles session-specific side effects that should run AFTER the main event handling.
 */
export function handleEventPostProcessing(
  session: Session,
  event: ClaudeEvent,
  ctx: SessionContext,
  mainHandling?: Promise<void>
): void {
  // Handle assistant events - extract PR URLs, detect commands
  if (event.type === 'assistant') {
    const msg = event.message as {
      content?: Array<{ type: string; text?: string }>;
    };
    for (const block of msg?.content || []) {
      if (block.type === 'text' && block.text) {
        // Detect and store pull request URLs
        extractAndUpdatePullRequest(block.text, session, ctx);
        // Subagent text is never displayed, so it must not drive visible side effects.
        if (isSidechainEvent(event)) continue;
        // Detect and execute Claude commands (e.g., !cd)
        detectAndExecuteClaudeCommands(block.text, session, ctx);
        // Multi-bot: a bot hands off ONLY via the explicit sentence
        // `@<peer> it's your turn.` in its OWN output — a bare @mention does not,
        // so peers can be named in prose without dropping the baton. Not acted on
        // mid-turn; it fires once at this bot's `result` (turn end) via
        // dispatchBotHandoff. Latest turn-signal in the turn wins.
        const peer = ctx.ops.resolveHandoffTarget(block.text, session.platformId);
        if (peer && peer !== session.platformId) {
          session.pendingHandoff = { toPlatformId: peer };
        }
      }
    }
  }

  // Handle result events - stop typing, update UI, extract usage
  if (event.type === 'result') {
    ctx.ops.stopTyping(session);
    session.isProcessing = false;
    // This bot just answered → it takes the floor in the thread. In a shared
    // channel the floor follows the bot that LAST ANSWERED (not the one last
    // @mentioned), so plain follow-ups continue with whoever just spoke.
    session.lastAddressedAt = Date.now();
    ctx.ops.emitSessionUpdate(session.sessionId, { status: getSessionStatus(session) });
    updateUsageStats(session, event, ctx);
    persistAfterTurn(session, ctx, mainHandling);

    // Turn is over → NOW fire any bot→bot handoff this bot signalled in its own
    // output. Doing it here (not when a peer receives the message) means the
    // handoff is triggered at turn end regardless of where the @mention sat in
    // the answer. Fire-and-forget: this post-processing hook is synchronous.
    const handoff = session.pendingHandoff;
    session.pendingHandoff = undefined;
    if (handoff) {
      void ctx.ops
        .dispatchBotHandoff(session.threadId, session.platformId, handoff.toPlatformId)
        .catch((err) => sessionLog(session).warn(`handoff dispatch failed: ${err instanceof Error ? err.message : String(err)}`));
    }
  }

  // Track tool errors for bug reporting context
  if (event.type === 'user' && !isSidechainEvent(event)) {
    for (const block of contentBlocks(event)) {
      if (block.type === 'tool_result' && block.is_error) {
        trackEvent(session, 'tool_error', 'Tool execution failed');
      }
    }
  }
  if (event.type === 'tool_result') {
    const result = event.tool_result as { is_error?: boolean };
    if (result.is_error) {
      trackEvent(session, 'tool_error', 'Tool execution failed');
    }
  }

  // Handle system errors
  if (event.type === 'system') {
    const e = event as ClaudeEvent & { subtype?: string; error?: string };
    if (e.subtype === 'error') {
      trackEvent(session, 'system_error', String(e.error).substring(0, 80));
    }
  }

}

function persistAfterTurn(session: Session, ctx: SessionContext, mainHandling?: Promise<void>): void {
  if (!mainHandling) {
    ctx.ops.persistSession(session);
    return;
  }
  // Waits for the turn's ops (task-list finalize) to settle, then skips if teardown already unregistered the session.
  void mainHandling
    .catch(() => undefined)
    .then(() => {
      if (ctx.state.sessions.get(session.sessionId) !== session) return;
      ctx.ops.persistSession(session);
    });
}

// ---------------------------------------------------------------------------
// MCP servers and auth status
// ---------------------------------------------------------------------------

const CLAUDE_AI_CONNECTOR_PREFIX = 'claude.ai ';

function describeMcpServers(servers: Array<{ name?: string; status?: string }>): string {
  return servers.map((s) => `${s.name ?? '?'} (${s.status ?? 'unknown'})`).join(', ');
}

function reportMcpServers(session: Session, servers: Array<{ name?: string; status?: string }>): void {
  const sorted = [...servers].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  const summary = describeMcpServers(sorted) || 'none';
  if (session.mcpServersSummary === summary) return;
  session.mcpServersSummary = summary;
  sessionLog(session).info(`MCP servers: ${summary}`);

  const down = servers.filter((s) => s.status !== 'connected' && s.status !== 'pending');
  if (down.length > 0) {
    sessionLog(session).warn(`MCP servers not connected: ${describeMcpServers(down)}`);
  }

  const connectors = servers.filter((s) => (s.name ?? '').startsWith(CLAUDE_AI_CONNECTOR_PREFIX));
  if (connectors.length === 0 || session.platform.getMcpConfig().claudeAiConnectors === true) return;
  const names = connectors.map((s) => s.name).join(', ');
  sessionLog(session).warn(
    `claude.ai connectors are active although claudeAiConnectors is off: ${names}. ` +
    `This Claude CLI ignores both disableClaudeAiConnectors and ENABLE_CLAUDEAI_MCP_SERVERS; upgrade it.`,
  );
  const f = session.platform.getFormatter();
  void withErrorHandling(
    () => post(session, 'warning',
      `${f.formatBold('claude.ai connectors are active in this session')} (${names}) although ` +
      `${f.formatCode('claudeAiConnectors')} is off for this platform. This Claude CLI version ignores the ` +
      `switch; upgrade the CLI on the bot's machine.`),
    { action: 'Post connector warning', session },
  );
}

function handleAuthStatus(
  session: Session,
  event: { isAuthenticating?: boolean; output?: string[]; error?: string }
): void {
  if (!event.error) {
    const lastLine = event.output?.length ? ` (${event.output[event.output.length - 1]})` : '';
    sessionLog(session).info(`🔐 Claude CLI auth status: authenticating=${event.isAuthenticating ?? false}${lastLine}`);
    return;
  }
  sessionLog(session).warn(`🔐 Claude CLI auth error: ${event.error}`);
  if (session.lastAuthErrorPosted === event.error) return;
  session.lastAuthErrorPosted = event.error;
  const error = event.error;
  void withErrorHandling(
    () => post(session, 'warning', `🔐 Claude CLI authentication problem: ${error}`),
    { action: 'Post auth status warning', session }
  );
}

// ---------------------------------------------------------------------------
// Compaction handling
// ---------------------------------------------------------------------------

/**
 * Handle compaction start - create a dedicated post that we can update later.
 */
function handleCompactionStart(
  session: Session,
  _ctx: SessionContext
): void {
  // Assigned synchronously: a failure or boundary in the same stdout chunk must await this post instead of racing it.
  session.compactionPostPromise = (async () => {
    // Close current post (flushes pending content) to avoid mixing with compaction message
    await session.messageManager?.closeCurrentPost();

    // Create the compaction status post
    const formatter = session.platform.getFormatter();
    const message = `🗜️ ${formatter.formatBold('Compacting context...')} ${formatter.formatItalic('(freeing up memory)')}`;
    const compactionPost = await withErrorHandling(
      () => post(session, 'info', message),
      { action: 'Post compaction start', session }
    );

    if (compactionPost) {
      session.compactionPostId = compactionPost.id;
      // Note: post() already calls updateLastMessage internally
    }
  })();
}

async function awaitCompactionStartPost(session: Session): Promise<void> {
  if (!session.compactionPostPromise) return;
  await session.compactionPostPromise.catch(() => {});
  session.compactionPostPromise = undefined;
}

async function handleCompactionFailed(session: Session, compactError: string | undefined): Promise<void> {
  await awaitCompactionStartPost(session);

  const formatter = session.platform.getFormatter();
  const message = `⚠️ ${formatter.formatBold('Compaction failed')} ${formatter.formatItalic(`(${compactError || 'unknown error'})`)}`;

  const startPostId = session.compactionPostId;
  if (startPostId) {
    await withErrorHandling(
      () => updatePost(session, startPostId, message),
      { action: 'Update compaction post (failed)', session }
    );
    session.compactionPostId = undefined;
    return;
  }
  await withErrorHandling(
    () => post(session, 'info', message),
    { action: 'Post compaction failure', session }
  );
}

/**
 * Handle compaction complete - update the existing compaction post.
 */
async function handleCompactionComplete(
  session: Session,
  compactMetadata: unknown,
  _ctx: SessionContext
): Promise<void> {
  await awaitCompactionStartPost(session);

  // Build the completion message with metadata
  const metadata = compactMetadata as { trigger?: string; pre_tokens?: number; post_tokens?: number } | undefined;
  const trigger = metadata?.trigger || 'auto';
  const preTokens = metadata?.pre_tokens;
  const postTokens = metadata?.post_tokens;
  let info = trigger === 'manual' ? 'manual' : 'auto';
  if (preTokens && preTokens > 0 && postTokens && postTokens > 0) {
    info += `, ${Math.round(preTokens / 1000)}k → ${Math.max(1, Math.round(postTokens / 1000))}k tokens`;
  } else if (preTokens && preTokens > 0) {
    info += `, ${Math.round(preTokens / 1000)}k tokens`;
  }
  const formatter = session.platform.getFormatter();
  const completionMessage = `✅ ${formatter.formatBold('Context compacted')} ${formatter.formatItalic(`(${info})`)}`;

  if (session.compactionPostId) {
    // Update the existing compaction post
    await updatePost(session, session.compactionPostId, completionMessage);
    session.compactionPostId = undefined;
  } else {
    // Fallback: create a new post if we don't have the original
    // Note: post() already calls updateLastMessage internally
    await withErrorHandling(
      () => post(session, 'info', completionMessage),
      { action: 'Post compaction complete', session }
    );
  }
}

// ---------------------------------------------------------------------------
// Usage stats extraction
// ---------------------------------------------------------------------------

/**
 * Result event structure from Claude CLI
 */
interface ResultEvent {
  type: 'result';
  subtype?: string;
  total_cost_usd?: number;
  /** Per-request token usage (accurate for context window calculation) */
  usage?: {
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
  };
  /** Cumulative billing per model across the session */
  modelUsage?: Record<string, {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    contextWindow: number;
    costUSD: number;
  }>;
}

/**
 * Convert model ID to display name
 * e.g., "claude-opus-4-5-20251101" -> "Opus 4.5"
 */
function getModelDisplayName(modelId: string): string {
  // Common model name patterns
  if (modelId.includes('opus-4-5') || modelId.includes('opus-4.5')) return 'Opus 4.5';
  if (modelId.includes('opus-4')) return 'Opus 4';
  if (modelId.includes('opus')) return 'Opus';
  if (modelId.includes('sonnet-4')) return 'Sonnet 4';
  if (modelId.includes('sonnet-3-5') || modelId.includes('sonnet-3.5')) return 'Sonnet 3.5';
  if (modelId.includes('sonnet')) return 'Sonnet';
  if (modelId.includes('haiku-4-5') || modelId.includes('haiku-4.5')) return 'Haiku 4.5';
  if (modelId.includes('haiku')) return 'Haiku';
  // Fallback: extract the model family name
  const match = modelId.match(/claude-(\w+)/);
  return match ? match[1].charAt(0).toUpperCase() + match[1].slice(1) : modelId;
}

/**
 * Extract usage stats from a result event and update session
 */
function updateUsageStats(
  session: Session,
  event: ClaudeEvent,
  ctx: SessionContext
): void {
  const result = event as ResultEvent;

  if (!result.modelUsage) return;

  // Find the primary model (highest cost, usually the main model)
  let primaryModel = '';
  let highestCost = 0;
  let contextWindowSize = 200000; // Default

  const modelUsage: Record<string, ModelTokenUsage> = {};
  let totalTokensUsed = 0;

  for (const [modelId, usage] of Object.entries(result.modelUsage)) {
    modelUsage[modelId] = {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadInputTokens: usage.cacheReadInputTokens,
      cacheCreationInputTokens: usage.cacheCreationInputTokens,
      contextWindow: usage.contextWindow,
      costUSD: usage.costUSD,
    };

    // Sum all tokens (for billing display)
    totalTokensUsed += usage.inputTokens + usage.outputTokens +
      usage.cacheReadInputTokens + usage.cacheCreationInputTokens;

    // Track primary model by highest cost
    if (usage.costUSD > highestCost) {
      highestCost = usage.costUSD;
      primaryModel = modelId;
      contextWindowSize = usage.contextWindow;
    }
  }

  // Calculate context tokens from per-request usage (accurate)
  // Falls back to primary model's cumulative tokens if usage not available
  let contextTokens = 0;
  if (result.usage) {
    // Per-request usage: actual tokens in current context window
    contextTokens = result.usage.input_tokens +
      result.usage.cache_creation_input_tokens +
      result.usage.cache_read_input_tokens;
  } else if (primaryModel && result.modelUsage[primaryModel]) {
    // Fallback: estimate from primary model's cumulative billing
    const primary = result.modelUsage[primaryModel];
    contextTokens = primary.inputTokens + primary.cacheReadInputTokens;
  }

  // Create or update usage stats
  const usageStats: SessionUsageStats = {
    primaryModel,
    modelDisplayName: getModelDisplayName(primaryModel),
    contextWindowSize,
    contextTokens,
    totalTokensUsed,
    totalCostUSD: result.total_cost_usd || 0,
    modelUsage,
    lastUpdated: new Date(),
  };

  session.usageStats = usageStats;

  const contextPct = contextWindowSize > 0
    ? Math.round((contextTokens / contextWindowSize) * 100)
    : 0;
  sessionLog(session).info(
    `Updated usage stats: ${usageStats.modelDisplayName}, ` +
    `context ${contextTokens}/${contextWindowSize} (${contextPct}%), ` +
    `$${usageStats.totalCostUSD.toFixed(4)}`
  );

  // Start periodic status bar timer if not already running
  if (!session.timers.statusBarTimer) {
    const STATUS_BAR_UPDATE_INTERVAL = 30000; // 30 seconds
    session.timers.statusBarTimer = setInterval(() => {
      // Only update if session is still active
      if (session.claude.isRunning()) {
        // Try to get more accurate context data from status line
        updateUsageFromStatusLine(session);
        ctx.ops.updateSessionHeader(session).catch(() => {});
      }
    }, STATUS_BAR_UPDATE_INTERVAL);
  }

  // Update status bar with new usage info
  ctx.ops.updateSessionHeader(session).catch(() => {});
}

/**
 * Update usage stats from the status line file if available.
 * This provides more accurate context window usage than result events.
 */
function updateUsageFromStatusLine(session: Session): void {
  const statusData = session.claude.getStatusData();
  if (!statusData) return;

  // Only update if we have existing usage stats
  if (!session.usageStats) return;

  // Use total_input_tokens which represents the cumulative context usage
  // (not current_usage which is just the per-request tokens)
  const contextTokens = statusData.total_input_tokens || 0;

  // Update context tokens if the status line data is newer
  if (statusData.timestamp > session.usageStats.lastUpdated.getTime()) {
    session.usageStats.contextTokens = contextTokens;
    session.usageStats.contextWindowSize = statusData.context_window_size;
    session.usageStats.lastUpdated = new Date(statusData.timestamp);

    // Update model info if available
    if (statusData.model) {
      session.usageStats.primaryModel = statusData.model.id;
      session.usageStats.modelDisplayName = statusData.model.display_name;
    }

    // Update cost if available
    if (statusData.cost) {
      session.usageStats.totalCostUSD = statusData.cost.total_cost_usd;
    }

    const contextPct = session.usageStats.contextWindowSize > 0
      ? Math.round((contextTokens / session.usageStats.contextWindowSize) * 100)
      : 0;
    sessionLog(session).debug(
      `Updated from status line: context ${contextTokens}/${session.usageStats.contextWindowSize} (${contextPct}%)`
    );
  }
}

