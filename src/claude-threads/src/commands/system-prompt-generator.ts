/**
 * System Prompt Generator
 *
 * Generates the chat platform system prompt from the unified command registry.
 * This ensures Claude's knowledge of commands stays in sync with actual behavior.
 */

import { tmpdir } from 'os';
import { VERSION } from '../version.js';
import {
  COMMAND_REGISTRY,
  getClaudeExecutableCommands,
  getClaudeAvoidCommands,
  type CommandDefinition,
} from './registry.js';
import type { PlatformClient } from '../platform/client.js';
import type { GitHubEmailsStore } from '../persistence/github-emails-store.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('system-prompt');

/**
 * Format a command for the user commands section of the system prompt.
 */
function formatUserCommand(cmd: CommandDefinition): string {
  const cmdStr = cmd.args ? `\`!${cmd.command} ${cmd.args}\`` : `\`!${cmd.command}\``;

  // For commands with simple descriptions, use inline format
  // For special cases (like !approve with alternative), add that info
  const description = cmd.description;
  if (cmd.command === 'approve') {
    return `- ${cmdStr} or 👍 reaction: Approve pending plan`;
  }
  if (cmd.command === 'stop') {
    return `- ${cmdStr} or ❌ reaction: End the current operation`;
  }
  if (cmd.command === 'escape') {
    return `- ${cmdStr} or ⏸️ reaction: Interrupt without ending the session`;
  }

  return `- ${cmdStr}: ${description}`;
}

/**
 * Format a command for Claude's executable commands section.
 */
function formatClaudeCommand(cmd: CommandDefinition): string {
  const cmdStr = cmd.args ? `\`!${cmd.command} ${cmd.args}\`` : `\`!${cmd.command}\``;
  let line = `- ${cmdStr}`;

  if (cmd.command === 'worktree' && cmd.subcommands) {
    // Special case: only list is useful for Claude
    line = '- `!worktree list` - List all worktrees. Result is sent back to you in a <command-result> tag.';
  } else if (cmd.claudeNotes) {
    line += ` - ${cmd.claudeNotes}`;
  } else {
    line += ` - ${cmd.description}`;
  }

  return line;
}

/**
 * Build session context line for the system prompt.
 *
 * The `**Thread:**` URL gives Claude a stable handle for the conversation it
 * is running inside. It is included so Claude can reference the chat from
 * artifacts it produces — e.g. paste it into the description of a merge
 * request or ticket so reviewers can trace the work back to the discussion.
 */
export function buildSessionContext(
  platform: {
    platformType: string;
    displayName: string;
    getThreadLink(threadId: string): string;
  },
  workingDir: string,
  threadId: string,
): string {
  const platformName = platform.platformType.charAt(0).toUpperCase() + platform.platformType.slice(1);
  const threadUrl = platform.getThreadLink(threadId);
  return `**Platform:** ${platformName} (${platform.displayName}) | **Working Directory:** ${workingDir} | **Thread:** ${threadUrl}`;
}

/**
 * Resolved collaborator with the data we need for a Co-Authored-By trailer.
 * `name` falls back to username when displayName is missing; `email` is required
 * (collaborators without an email cannot be tagged as co-author).
 */
export interface ResolvedCollaborator {
  username: string;
  name: string;
  email: string;
}

/**
 * Resolve the co-authorable collaborators for a session.
 *
 * For each non-owner username in `sessionAllowedUsers`, look up:
 *   - the GitHub noreply email from the local store (self-registered via
 *     `!github-email`). This is the address used in the `Co-Authored-By:`
 *     trailer. We do **not** read platform emails: those are private (real
 *     mail addresses) and would leak to the chat thread / Claude history.
 *   - a human display name from the platform (best-effort) for the trailer's
 *     `Name <email>` segment. Falls back to the username when unavailable.
 *
 * Owner is excluded — the owner is the implicit author. Collaborators without
 * a registered noreply email are skipped silently (debug-logged); the caller
 * is responsible for nudging them to register.
 */
export async function resolveCollaborators(
  platform: Pick<PlatformClient, 'getUserByUsername'>,
  platformId: string,
  ownerUsername: string,
  allowedUsers: Iterable<string>,
  githubEmailsStore: Pick<GitHubEmailsStore, 'get'>,
): Promise<ResolvedCollaborator[]> {
  const resolved: ResolvedCollaborator[] = [];
  for (const username of allowedUsers) {
    if (username === ownerUsername) continue;
    const email = githubEmailsStore.get(platformId, username);
    if (!email) {
      log.debug(`Collaborator @${username} has no registered GitHub noreply email — skipping`);
      continue;
    }
    let name = username;
    try {
      const user = await platform.getUserByUsername(username);
      if (user) name = user.displayName || user.username;
    } catch (err) {
      log.debug(`Display name lookup failed for @${username}: ${(err as Error).message}`);
    }
    resolved.push({ username, name, email });
  }
  return resolved;
}

/**
 * Build the "Git commit attribution" section of the system prompt.
 *
 * Two shapes:
 * - No collaborators: a one-liner that only kicks in if a "Collaborators
 *   updated" notice appears later in the thread. Solo sessions stay quiet.
 * - With collaborators: the full rule plus the current list and a pointer
 *   to the thread for later updates.
 */
export function buildCollaboratorContext(collaborators: ResolvedCollaborator[]): string {
  if (collaborators.length === 0) {
    return `If a "Collaborators updated" notice appears in this thread, add each listed person as a \`Co-Authored-By: Name <email>\` trailer on subsequent git commits. Do not add the session owner (they are the implicit author), the bot, or any AI assistant.`;
  }

  const lines = collaborators.map(c => `- ${c.name} <${c.email}>`).join('\n');
  return `## Git commit attribution

When you create a git commit in this session, add every current collaborator
listed below as a \`Co-Authored-By:\` trailer at the end of the commit
message, each on its own line, after a blank line separating them from the
body. Use the format \`Co-Authored-By: Name <email>\`. Do not add the session
owner (they are the implicit author), the bot, or any AI assistant.

Current collaborators:
${lines}

If a "Collaborators updated" notice appears later in this thread, use the
list from the most recent such notice instead — it supersedes this one.`;
}

/**
 * Format the collaborator list for an in-thread "collaborators updated" notice.
 * Returns an empty string when there is nothing co-authorable; the caller
 * is expected to produce a "no co-authors" sentence in that case.
 */
export function formatCollaboratorListForChat(collaborators: ResolvedCollaborator[]): string {
  return collaborators.map(c => `${c.name} <${c.email}>`).join(', ');
}

/** A peer bot the current bot can hand off to, with its optional specialization. */
export interface PeerBotInfo {
  name: string;
  description?: string;
  /** True when this peer runs with an `unrestricted` writeScope (the "chief"),
   *  so a confined bot can hand an out-of-scope write off to it by name. */
  unrestricted?: boolean;
}

/**
 * Build the "other assistants in this thread" section — only when peer bots
 * share the channel. Teaches the bot that other assistants exist, WHAT each is
 * specialized in (so it can decide when to consult which peer), and how to hand
 * off: strictly `@name` (no space), the only form our mention detection (and
 * Mattermost/Slack) recognizes. Reinforces that a reply without an `@name` is
 * for the user, so bots don't chatter at each other.
 */
export function buildPeerBotContext(peerBots: PeerBotInfo[]): string {
  if (peerBots.length === 0) return '';
  // List each peer with its specialization when known, so the bot can judge
  // WHEN to hand off to WHICH peer.
  const list = peerBots
    .map(p => (p.description ? `- \`@${p.name}\` — ${p.description}` : `- \`@${p.name}\``))
    .join('\n');
  const example = peerBots[0].name;
  return `## Other assistants in this thread

Other AI assistants share this thread and can be brought in:
${list}

**How turns work — read carefully:**
- **End every message with exactly \`@<name> it's your turn.\`** — that plain text sentence is the only thing that passes the turn (no bold/italics/backticks/space after \`@\`: ✅ \`@${example} it's your turn.\`  ❌ \`**@${example}**\`). \`<name>\` is the peer to hand to, or the user when you're done. A bare \`@name\` elsewhere does NOT hand off — mention peers freely in prose; a message without the closing line goes to the user.
- **Proactively consult the right peer when a topic hits their specialty** — don't answer outside your lane, and you do NOT need the user's explicit permission. Treat it as a standing check on EVERY turn (it fades on long threads); each hand-off carries a concrete question, not a greeting.
- **Hand off with a self-contained message** — the question, answer, or advice must stand on its own: put the facts, file paths, and values it needs right in the message, not "see above".
- **Say how much you want back** (peers over-answer): e.g. "one sentence", "just the path", "yes/no + one reason". When answering, honour the size asked; if none given, keep it tight — only what was asked, no preamble.
- **Pass the turn to whoever acts next** — the caller, a different peer if it now fits their specialty (A→B→C chains are fine), or the user when resolved. No need to bounce straight back.`;
}

/**
 * A one-line, model-only "expert peers" roster to prepend to each multi-bot
 * turn (via prependMissedDelta). The full peer section lives at the top of the
 * system prompt but fades from attention on long threads; re-stating the roster
 * inside the current turn — exactly when the bot decides whether to consult a
 * specialist — keeps it salient at negligible cost. Returns '' when solo.
 */
export function buildExpertPeerRoster(peerBots: PeerBotInfo[]): string {
  if (peerBots.length === 0) return '';
  const list = peerBots
    .map((p) => (p.description ? `@${p.name} (${p.description})` : `@${p.name}`))
    .join(', ');
  return `[Expert peers in this thread you can consult — ${list}. `
    + `To hand off, end your message with "@name it's your turn." and state the reply size you want.]`;
}

/**
 * The file-write-scope rule for a confined bot.
 *
 * This is prompt-level GUIDANCE, not an enforcement boundary — a genuinely
 * adversarial or careless model can still write outside. It exists to steer a
 * cooperative model away from a peer bot's project (the common failure: an
 * advisory bot editing the main project's `/app` instead of its own
 * workspace). Real isolation would need OS/container boundaries.
 *
 * Reads are deliberately NOT restricted (the bot may need to read the main
 * project to advise on it); only writes are scoped. `tmpdir` is included
 * because attachments and scratch files live there.
 *
 * When a `chiefBotName` is given (a same-thread peer running unrestricted), the
 * rule tells the bot to HAND the write off to that peer by name instead of just
 * refusing — so out-of-scope work still gets done, by the bot allowed to do it.
 */
export function buildWriteScopeContext(workingDir: string, chiefBotName?: string): string {
  const outOfScopeAction = chiefBotName
    ? `do NOT do it yourself. Instead hand it to \`@${chiefBotName}\`, which is allowed to write there: end your message with \`@${chiefBotName} it's your turn.\` and include the exact file path(s) and what to write.`
    : `do NOT do it: stop and say the target is outside your allowed write scope.`;
  return `## File write scope (STRICT)

You may CREATE, EDIT, MOVE, or DELETE files ONLY inside these two directories:
- your working directory: \`${workingDir}\`
- the system temp directory: \`${tmpdir()}\`

Writing anywhere else — other projects, another bot's working directory, or any
system path (e.g. \`/app\`, \`/etc\`, a sibling repo) — is STRICTLY FORBIDDEN,
even if a user asks. If a task would require writing outside your scope, ${outOfScopeAction} Reading files outside these directories is allowed.`;
}

/**
 * The counterpart to {@link buildWriteScopeContext}: the rule for the
 * UNRESTRICTED bot ("chief") when confined peers share its thread. It tells the
 * chief that (a) it is the write-authority others delegate to, and (b) a
 * hand-off write must be sanity-checked, not executed blindly — the chief is
 * the last safeguard against a confined peer steering an unwanted write into a
 * path it can't reach itself.
 */
export function buildWriteAuthorityContext(): string {
  return `## You are the write-authority bot

You run with unrestricted write access. Other assistants in this thread are
confined to their own working directories and will hand YOU writes that fall
outside their scope (their message ends with \`@<you> it's your turn.\`).

When you receive such a hand-off, do NOT perform the write blindly — you are the
last safeguard. First check it's legitimate: the target path is the intended
one, the change matches what the user actually asked for, and it isn't
destructive or out of place. If it looks wrong, unclear, or unintended, pause
and confirm with the user instead of writing.`;
}

/**
 * The self-identity heading for a NON-chief bot in a multi-bot thread — the
 * minimal symmetric counterpart to {@link buildWriteAuthorityContext}'s
 * heading. Deliberately a single line: persona/specialty comes from the bot's
 * own CLAUDE.md, and the handoff/lane mechanics live in the peer section, so
 * this only needs to place the bot in the ensemble.
 */
export function buildPeerContributorContext(): string {
  return `## You are a peer contributor here, stay in your lane`;
}

/**
 * Compose the full `appendSystemPrompt` for a Claude session.
 *
 * Layers (in order, blank-line-separated):
 *   1. session context line — included unless `omitSessionContext` is set,
 *      which is the worktree-respawn case where Claude already has a title
 *      and the bestaande spawn-pad omits it to keep prompt-rebuilds cheap.
 *   1b. write-scope rule — when `writeConfined` is set (the default, non-
 *      `unrestricted` writeScope). Placed high so it's salient, and emitted
 *      independently of `omitSessionContext` so it can't drop on a respawn.
 *   2. static chat-platform prompt (commands, send_file, etc.)
 *   3. collaborator co-author section — always included so the rule can't
 *      silently disappear across `!cd` / worktree / resume.
 *
 * Centralizing every spawn-site through this helper guarantees they all
 * teach Claude the same conventions; adding a layer in one place but not
 * another previously caused `!cd` to silently strip attribution.
 */
export async function buildAppendSystemPrompt(
  platform: Pick<PlatformClient, 'getUserByUsername'> & {
    platformType: string;
    displayName: string;
    getThreadLink(threadId: string): string;
  },
  platformId: string,
  workingDir: string,
  threadId: string,
  ownerUsername: string,
  allowedUsers: Iterable<string>,
  staticChatPlatformPrompt: string,
  githubEmailsStore: Pick<GitHubEmailsStore, 'get'>,
  options?: { omitSessionContext?: boolean; peerBots?: PeerBotInfo[]; writeConfined?: boolean },
): Promise<string> {
  const collaborators = await resolveCollaborators(
    platform,
    platformId,
    ownerUsername,
    allowedUsers,
    githubEmailsStore,
  );
  const collaboratorSection = buildCollaboratorContext(collaborators);

  const parts: string[] = [];
  if (!options?.omitSessionContext) {
    parts.push(buildSessionContext(platform, workingDir, threadId));
  }
  // Self-identity in a multi-bot thread (symmetric): the chief gets the
  // write-authority role, every other bot the peer-contributor role. The chief
  // is the unrestricted bot that has ≥1 confined peer handing writes to it.
  const peers = options?.peerBots ?? [];
  const isChief = options?.writeConfined === false && peers.some((p) => !p.unrestricted);
  if (isChief) {
    parts.push(buildWriteAuthorityContext());
  } else if (peers.length > 0) {
    parts.push(buildPeerContributorContext());
  }
  // The write-scope rule for a confined bot. Emitted independently of
  // omitSessionContext so it can't drop on a worktree/`!cd` respawn; if a
  // same-thread peer runs unrestricted, name it as the hand-off target.
  if (options?.writeConfined) {
    const chief = peers.find((p) => p.unrestricted)?.name;
    parts.push(buildWriteScopeContext(workingDir, chief));
  }
  parts.push(staticChatPlatformPrompt);
  const peerBotSection = buildPeerBotContext(options?.peerBots ?? []);
  if (peerBotSection) parts.push(peerBotSection);
  parts.push(collaboratorSection);
  return parts.join('\n\n');
}

/**
 * Who the bot actually is, for the prompt's identity line. The default (no
 * identity passed) is the Claude backend. For opencode-backed sessions the
 * underlying model is whatever the platform config / opencode.json says — the
 * prompt must NOT claim to be Claude, or non-Claude models dutifully role-play
 * being "Claude" when users ask (observed: DeepSeek introducing itself as
 * "Claude Opus 4.5" because this prompt told it so).
 */
export interface AgentIdentity {
  backend: 'claude' | 'opencode';
  /** Model spec as configured (e.g. `openrouter/deepseek/deepseek-v4-pro`); undefined = opencode's own default. */
  model?: string;
}

/** The identity bullet(s) for the "How This Works" section. */
function identityLines(identity?: AgentIdentity): string {
  if (!identity || identity.backend === 'claude') {
    return '- You are Claude Code running as a bot via "Claude Threads"';
  }
  const modelLine = identity.model
    ? `- Your underlying AI model is \`${identity.model}\` — that is what you say when asked who or which model you are. ("Claude Threads" is the name of this bot bridge, and command descriptions may mention Claude; neither says anything about your model.)`
    : `- Your underlying AI model is set in the opencode server's config. If asked which model you are and you don't know, say it's configured by the operator — don't guess. ("Claude Threads" is the name of this bot bridge, and command descriptions may mention Claude; neither says anything about your model.)`;
  return `- You are an AI agent running on the opencode runtime as a bot via "Claude Threads"\n${modelLine}`;
}

/**
 * Generate the chat platform system prompt from the command registry.
 *
 * This prompt is appended to Claude's system prompt via --append-system-prompt.
 * It provides context about running in a chat platform and available commands.
 *
 * @param identity - which backend/model the session actually runs on; omit for
 *                   the Claude backend (historic default).
 */
export function generateChatPlatformPrompt(identity?: AgentIdentity): string {
  // Get user commands (excluding passthrough)
  const userCommands = COMMAND_REGISTRY
    .filter(cmd =>
      cmd.category !== 'passthrough' &&
      ['stop', 'escape', 'pause', 'approve', 'invite', 'kick', 'cd', 'permissions', 'update'].includes(cmd.command)
    );

  // Format user commands section
  const userCommandLines = userCommands.map(formatUserCommand);

  // Add update subcommands
  const updateCmd = COMMAND_REGISTRY.find(c => c.command === 'update');
  if (updateCmd?.subcommands) {
    const updateIndex = userCommandLines.findIndex(l => l.includes('!update'));
    if (updateIndex !== -1) {
      // Replace the update line with expanded version
      userCommandLines[updateIndex] = '- `!update`: Show auto-update status';
      userCommandLines.splice(updateIndex + 1, 0,
        '- `!update now`: Apply pending update immediately',
        '- `!update defer`: Defer pending update for 1 hour'
      );
    }
  }

  // Get Claude executable commands
  const claudeCommands = getClaudeExecutableCommands()
    .filter(cmd => ['worktree', 'cd'].includes(cmd.command));

  // Get commands Claude should avoid
  const avoidCommands = getClaudeAvoidCommands();

  return `
You are running inside a chat platform (like Mattermost or Slack). Users interact with you through chat messages in a thread.

**Claude Threads Version:** ${VERSION}

## How This Works
${identityLines(identity)}
- Your responses appear as messages in a chat thread
- Keep responses concise - very long responses are split across multiple messages
- Multiple users may participate in a session (the owner can invite others)

## Sending files into THIS thread
You are RIGHT NOW running inside a chat thread (Mattermost or Slack). The \`send_file\` MCP tool — exposed as \`mcp__claude-threads-mcp__send_file\` in your tool list — uploads a file from your working directory and posts it directly into THIS thread, where the user is talking to you. It is NOT a hypothetical capability that requires extra setup; it works for the session you are in right now.

Use it whenever the user asks to "send", "share", "show", or "post" a file, OR whenever you produce an artifact (screenshot, generated audio, plot, document, PDF) that the user would benefit from seeing inline rather than as a path to read.

Arguments: \`{ path: <absolute path inside the working directory>, caption?: <optional one-line message> }\`. Returns a JSON envelope: \`{ ok: true, postId }\` on success or \`{ ok: false, reason }\` on failure — when it fails, surface \`reason\` to the user verbatim so they understand what went wrong (e.g. "outside the working directory", "file too large").

Do NOT tell the user the tool isn't available, doesn't apply, or requires Mattermost — it's wired up and pointed at this very thread. Just call it.

## Permissions & Interactions
- Permission requests (file writes, commands, etc.) appear as messages with emoji options
- Users approve with 👍 or deny with 👎 by reacting to the message
- Plan approvals and questions also use emoji reactions (👍/👎 for plans, number emoji for choices)
- Users can also type \`!approve\` or \`!yes\` to approve pending plans

## User Commands
Users can control sessions with these commands:
${userCommandLines.join('\n')}

## Commands You Can Execute
You can execute certain commands by writing them on their own line in your response.
The bot intercepts these and executes them, then sends results back to you.

Available commands:
${claudeCommands.map(formatClaudeCommand).join('\n')}

Commands you should NOT use (counterproductive):
${avoidCommands.map(c => `- \`!${c.command}\` - ${c.reason}`).join('\n')}
`.trim();
}
