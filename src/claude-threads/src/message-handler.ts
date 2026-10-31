/**
 * Message Handler Module
 *
 * Extracted from index.ts to allow reuse in both the main bot and integration tests.
 * This ensures tests exercise the actual bot logic, not a duplicate.
 */

import type { PlatformClient, PlatformPost, PlatformUser } from './platform/index.js';
import type { SessionManager } from './session/index.js';
import {
  parseCommand,
  parseCommandWithRemainder,
  executeCommand,
  isDynamicSlashCommand,
  handleDynamicSlashCommand,
  COMMAND_REGISTRY,
  type CommandExecutorContext,
} from './commands/index.js';
import type { InitialSessionOptions } from './session/types.js';
import { logSilentError } from './utils/error-handler/index.js';

/**
 * Prefix a user message with a permalink to THAT specific message, so the model
 * has a handle on the exact message (rather than only the thread-root permalink
 * from the session context). Kept to a bare metadata line — WHAT to do with it
 * (e.g. react to the message) is taught once in the base/system prompt and the
 * tool descriptions, not repeated per message.
 */
function withMessagePermalink(client: PlatformClient, post: PlatformPost, content: string): string {
  return `[message permalink: ${client.getPostPermalink(post)}]\n${content}`;
}

/**
 * Logger interface for message handler
 */
export interface MessageHandlerLogger {
  error(message: string): void;
  debug?(message: string): void;
}

/**
 * Options for message handler
 */
export interface MessageHandlerOptions {
  platformId: string;
  logger?: MessageHandlerLogger;
  /**
   * Called when !kill command is executed. In production this calls process.exit(0).
   * In tests this can just disconnect without exiting.
   */
  onKill?: (username: string) => void | Promise<void>;
  /**
   * Internal: set when SessionManager.dispatchBotHandoff replays a bot→bot
   * handoff at the author's turn end. Skips the receipt gate (which discards all
   * bot-authored messages) so the handoff is delivered through the normal
   * follow-up/new-session path. The dispatcher has already moved the baton.
   */
  dispatchedHandoff?: boolean;
}

/**
 * A bare "stop" message used as the immediate-interrupt keyword — the chat
 * equivalent of ESC in the Claude CLI. Matched on the whole (trimmed) message
 * so it can't trigger on "stop" appearing inside a normal sentence. Accepts the
 * German "stopp" spelling too. Distinct from `!stop`, which cancels/kills the
 * session; this only interrupts the current answer and keeps the session alive.
 */
function isStopKeyword(content: string): boolean {
  const c = content.trim().toLowerCase();
  return c === 'stop' || c === 'stopp';
}

/**
 * Handle an incoming message from a platform.
 *
 * This is the core message handling logic extracted from index.ts.
 * Both the main bot and integration tests use this same code.
 */
export async function handleMessage(
  client: PlatformClient,
  session: SessionManager,
  post: PlatformPost,
  user: PlatformUser | null,
  options: MessageHandlerOptions
): Promise<void> {
  const { platformId, logger, onKill, dispatchedHandoff } = options;
  const username = user?.username || 'unknown';
  const message = post.message;
  const threadRoot = post.rootId || post.id;
  const formatter = client.getFormatter();

  try {
    // Check for !kill command (emergency shutdown)
    const lowerMessage = message.trim().toLowerCase();
    if (
      lowerMessage === '!kill' ||
      (client.isBotMentioned(message) && client.extractPrompt(message).toLowerCase() === '!kill')
    ) {
      if (!client.isUserAllowed(username)) {
        await client.createPost(`⛔ Only authorized users can use ${formatter.formatCode('!kill')}`, threadRoot);
        return;
      }
      // Post confirmation to the channel where !kill was issued
      const activeCount = session.registry.getActiveThreadIds().length;
      try {
        await client.createPost(
          `🔴 ${formatter.formatBold('EMERGENCY SHUTDOWN')} initiated by ${formatter.formatUserMention(username)} - killing ${activeCount} active session${activeCount !== 1 ? 's' : ''}`,
          threadRoot
        );
      } catch (err) {
        logSilentError('kill-confirmation-post', err);
      }

      // Notify all other active sessions before killing
      for (const tid of session.registry.getActiveThreadIds()) {
        if (tid === threadRoot) continue; // Skip the thread where we already posted
        try {
          await client.createPost(`🔴 ${formatter.formatBold('EMERGENCY SHUTDOWN')} by ${formatter.formatUserMention(username)}`, tid);
        } catch (err) {
          logSilentError('kill-notify-session', err);
        }
      }
      logger?.error(`EMERGENCY SHUTDOWN initiated by @${username}`);
      await session.killAllSessions();
      client.disconnect();
      // Call the kill callback (production calls process.exit, tests just return)
      await onKill?.(username);
      return;
    }

    // --- Multi-bot baton ("Stab") gate (shared channel) ---
    // Skipped for a dispatched handoff: SessionManager.dispatchBotHandoff has
    // already moved the baton and is replaying the author's handoff message into
    // THIS bot's session — let it fall straight through to delivery.
    if (!dispatchedHandoff) {
      // Bot-authored messages NEVER trigger anything at receipt. A bot's own
      // posts (echo-safety) and peer bots' handoff @mentions are both ignored
      // here. A bot→bot handoff is instead fired by the AUTHOR at its turn end
      // (dispatchBotHandoff), so the @mention's position within the turn — or a
      // peer racing the author's still-streaming output — can't matter.
      if (session.isBotUsername(username)) return;

      // A human message is a fresh user impulse → reset the bot-to-bot loop budget.
      session.noteUserActivity(threadRoot);

      // Only the baton holder answers. An @mention moves the baton to that bot;
      // a plain reply goes to whoever currently holds it. The user never holds it.
      const mentionedBot = session.resolveMentionedBot(message, platformId);
      if (mentionedBot) {
        session.transferBaton(threadRoot, mentionedBot, { byBot: false });
        if (mentionedBot !== platformId) return; // user addressed a peer → I stay silent
        // addressed to me → I hold the baton; fall through and answer.
      } else {
        // Plain user reply → only the baton holder answers. Seed from the legacy
        // floor once for threads that predate explicit coordination.
        const holder = session.getBatonHolder(threadRoot) ?? session.seedBatonFromFloor(threadRoot);
        if (holder) {
          if (holder !== platformId) return; // a peer holds the baton
          // holder === me → fall through and answer
        } else if (session.registry.hasSessionInThreadExcept(threadRoot, platformId)) {
          // Unknown holder AND another bot has a session here → ambiguous;
          // require an explicit @mention. Single-bot threads fall through.
          return;
        }
      }
    }

    // Follow-up in active thread.
    // Scope the lookup to THIS platform's sessions. With multiple bots in the
    // same channel, an unscoped `findByThreadId` let bot B's platform resolve
    // bot A's session and relay A's (bot-authored) posts back into it — an
    // infinite self-reply loop. Each bot only owns the threads where it was
    // @mentioned, so a message must match a session on its own platform.
    const activeSession = session.registry.find(platformId, threadRoot);
    if (activeSession) {
      // If message starts with @mention to someone else, track it as side conversation (if from approved user)
      const mentionMatch = message.trim().match(/^@([\w.-]+)/);
      if (mentionMatch && mentionMatch[1].toLowerCase() !== client.getBotName().toLowerCase()) {
        // Track side conversation if from approved user
        if (session.isUserAllowedInSession(threadRoot, username)) {
          session.addSideConversation(threadRoot, {
            fromUser: username,
            mentionedUser: mentionMatch[1],
            message: message,
            timestamp: new Date(),
            postId: post.id,
          });
        }
        return; // Side conversation, don't interrupt
      }

      const content = client.isBotMentioned(message)
        ? client.extractPrompt(message)
        : message.trim();

      // Immediate "stop" kill switch: a bare "stop" message interrupts the
      // current answer at once — the chat equivalent of pressing ESC in the
      // Claude CLI (SIGINT), keeping the session alive. This MUST run before the
      // follow-up path below: otherwise the text would just be queued to the
      // agent and only act after the answer it was meant to stop. Gated to
      // session-authorized users, like the other controls.
      if (isStopKeyword(content)) {
        if (session.isUserAllowedInSession(threadRoot, username)) {
          await session.interruptSession(threadRoot, username, platformId);
        }
        return;
      }

      // Parse command using shared parser
      const parsed = parseCommand(content);
      if (parsed) {
        const isAllowed = session.isUserAllowedInSession(threadRoot, username);

        // Build executor context
        const ctx: CommandExecutorContext = {
          commandContext: 'in-session',
          threadId: threadRoot,
          username,
          client,
          sessionManager: session,
          formatter,
          isAllowed,
          files: post.metadata?.files,
        };

        // Try unified command executor
        const result = await executeCommand(parsed.command, parsed.args, ctx);
        if (result.handled) {
          return;
        }

        // Handle dynamic slash commands (from Claude CLI's init event)
        const defaultPassthroughCommands = new Set(['context', 'cost', 'compact']);
        const availableCommands = activeSession.availableSlashCommands ?? defaultPassthroughCommands;

        if (isDynamicSlashCommand(parsed.command, availableCommands)) {
          const dynamicResult = await handleDynamicSlashCommand(parsed.command, parsed.args, ctx);
          if (dynamicResult.handled) {
            return;
          }
        }

        // Kill is handled earlier in the code, so we just return
        if (parsed.command === 'kill') {
          return;
        }

        // Unknown command - don't treat as regular message
        return;
      }

      // Check for pending worktree prompt - treat message as branch name response.
      // This runs BEFORE the quiet-mode gate below: a pending interactive prompt
      // means the bot just asked the user for a branch name, so their plain reply
      // (typically without an @mention) is clearly directed at the bot and must be
      // consumed even in quiet mode. Mirrors how commands bypass the gate.
      if (session.hasPendingWorktreePrompt(threadRoot)) {
        // Only session owner can respond
        if (session.isUserAllowedInSession(threadRoot, username)) {
          const handled = await session.handleWorktreeBranchResponse(
            threadRoot,
            content,
            username,
            post.id
          );
          if (handled) return;
        }
      }

      // Quiet mode (#402): when the session opts into "respond only when
      // mentioned", a non-command reply that doesn't @mention the bot is a side
      // conversation between users — ignore it so it doesn't interrupt Claude.
      // Commands and pending worktree-prompt responses are already handled above
      // and so always work, including `!mentions off` to leave quiet mode.
      if (activeSession.respondOnlyWhenMentioned && !client.isBotMentioned(message)) {
        return;
      }

      // Check if user is allowed in this session. A peer BOT reaching this point
      // is an authorized bot-to-bot handoff (it only got here by @mentioning this
      // bot and passing the baton gate), so it must NOT go through the human
      // message-approval flow — otherwise the peer shows up as "Message from
      // @OtherBot needs approval". Let the handoff through.
      if (!session.isUserAllowedInSession(threadRoot, username) && !session.isBotUsername(username)) {
        // Request approval for their message
        if (content) await session.requestMessageApproval(threadRoot, username, content);
        return;
      }

      // Get any attached files (images)
      const files = post.metadata?.files;

      if (content || files?.length) {
        // Attach this message's own permalink when it differs from the thread
        // root (the root's permalink is already in the session context). Only
        // annotate when there's text.
        const contentForAgent = content && post.id !== threadRoot
          ? withMessagePermalink(client, post, content)
          : content;
        await session.sendFollowUp(threadRoot, contentForAgent, files, username, user?.displayName, { triggeringPostId: post.id, platformId });
      }
      return;
    }

    // Check for paused session that can be resumed.
    // Same platform-scoping as the active branch: only consider a paused
    // session that belongs to THIS platform, so one bot can't resume (or get
    // looped into) another bot's thread in a shared channel.
    const persistedForThread = session.registry.getPersistedByThreadId(threadRoot, platformId);
    const hasPausedSession = persistedForThread !== undefined;
    if (hasPausedSession) {
      // If message starts with @mention to someone else, ignore it (side conversation)
      const mentionMatch = message.trim().match(/^@([\w.-]+)/);
      if (mentionMatch && mentionMatch[1].toLowerCase() !== client.getBotName().toLowerCase()) {
        return; // Side conversation, don't interrupt
      }

      const content = client.isBotMentioned(message)
        ? client.extractPrompt(message)
        : message.trim();

      // Parse commands even for paused sessions - !stop should cancel, not resume
      const pausedParsed = parseCommand(content);
      if (pausedParsed) {
        if (pausedParsed.command === 'stop') {
          // Clean up the paused session instead of resuming it
          const persistedSession = session.getPersistedSession(threadRoot, platformId);
          if (persistedSession) {
            const allowedUsers = new Set(persistedSession.sessionAllowedUsers);
            if (allowedUsers.has(username) || client.isUserAllowed(username)) {
              session.cancelPausedSession(threadRoot, platformId);
              await client.createPost(
                `🛑 ${formatter.formatBold('Session cancelled')} by ${formatter.formatUserMention(username)}`,
                threadRoot
              );
            }
          }
        }
        // All commands in paused state are consumed (not passed as prompts)
        return;
      }

      // Check if user is allowed in the paused session
      const persistedSession = session.getPersistedSession(threadRoot, platformId);
      if (persistedSession) {
        const allowedUsers = new Set(persistedSession.sessionAllowedUsers);
        if (!allowedUsers.has(username) && !client.isUserAllowed(username)) {
          // Not allowed - could request approval but that would require the session to be active
          await client.createPost(
            `⚠️ ${formatter.formatUserMention(username)} is not authorized to resume this session`,
            threadRoot
          );
          return;
        }
      }

      // Quiet mode (#402, fix #410): a session that opted into "respond only
      // when mentioned" keeps that setting while paused. A plain reply that
      // doesn't @mention the bot must not silently resume the session — the
      // persisted flag survives the idle pause, so honor it here just like the
      // active-session gate above. Commands (incl. !stop) are handled earlier
      // and so still bypass this gate.
      if (persistedSession?.respondOnlyWhenMentioned && !client.isBotMentioned(message)) {
        return;
      }

      // Get any attached files (images)
      const files = post.metadata?.files;

      if (content || files?.length) {
        // Pass the triggering post id so the missed-messages delta excludes it
        // (it's delivered as the current request, not as missed context).
        await session.resumePausedSession(threadRoot, content, files, username, platformId, post.id);
      }
      return;
    }

    // New session requires @mention
    if (!client.isBotMentioned(message)) return;

    if (!client.isUserAllowed(username)) {
      await client.createPost(`⚠️ ${formatter.formatUserMention(username)} is not authorized`, threadRoot);
      return;
    }

    let prompt = client.extractPrompt(message);
    const files = post.metadata?.files;

    if (!prompt && !files?.length) {
      await client.createPost(`Mention me with your request`, threadRoot);
      return;
    }

    // ---------------------------------------------------------------------------
    // Parse and handle commands that work in the first message
    // Uses unified command executor with stacking support
    // ---------------------------------------------------------------------------
    const initialOptions: InitialSessionOptions = {};
    let worktreeBranch: string | undefined;

    // Build executor context for first-message commands
    const ctx: CommandExecutorContext = {
      commandContext: 'first-message',
      threadId: threadRoot,
      username,
      client,
      sessionManager: session,
      formatter,
      isAllowed: true, // Already verified authorization above
      files,
    };

    // Process commands that can appear at the start of the first message
    let continueProcessing = true;
    while (continueProcessing) {
      continueProcessing = false;

      // Try to parse a first-message command
      const parsed = parseCommandWithRemainder(prompt);
      if (!parsed) break;

      // Check if this command works in first message
      const cmdDef = COMMAND_REGISTRY.find(c => c.command === parsed.command);
      if (!cmdDef?.worksInFirstMessage) break;

      // Execute the command
      const result = await executeCommand(parsed.command, parsed.args, ctx);

      // If command fully handled (immediate commands like !help), we're done
      if (result.handled) {
        return;
      }

      // Apply any session options from the command
      if (result.sessionOptions) {
        Object.assign(initialOptions, result.sessionOptions);
      }

      // Set worktree branch if returned
      if (result.worktreeBranch) {
        worktreeBranch = result.worktreeBranch;
      }

      // Use remainder text for next iteration or as final prompt
      // For worktree branch creation, use remainingText if provided
      if (result.remainingText !== undefined) {
        prompt = result.remainingText;
      } else if (parsed.remainder !== undefined) {
        prompt = parsed.remainder;
      } else {
        prompt = '';
      }

      // Continue if this is a stackable command with more text to process
      continueProcessing = !!prompt && (cmdDef.isStackable || result.continueProcessing === true);
    }

    // Check for inline branch syntax: "on branch X" (legacy support)
    if (!worktreeBranch) {
      const branchMatch = prompt.match(/on branch\s+(\S+)/i);
      if (branchMatch) {
        worktreeBranch = branchMatch[1];
        prompt = prompt.replace(/on branch\s+\S+/i, '').trim();
      }
    }

    // If no prompt remains and no files and no worktree, don't start session
    // But if we have a worktree branch, we can start session with empty prompt
    if (!prompt.trim() && !files?.length && !worktreeBranch) {
      // Options were set but no actual prompt - could optionally start session anyway
      // For now, require a prompt or files (unless worktree specified)
      await client.createPost(`Mention me with your request`, threadRoot);
      return;
    }

    // Start session with worktree if branch specified
    if (worktreeBranch) {
      await session.startSessionWithWorktree(
        { prompt, files },
        worktreeBranch,
        username,
        threadRoot,
        platformId,
        user?.displayName,
        post.id,  // triggeringPostId
        initialOptions
      );
      return;
    }

    await session.startSession(
      { prompt, files },
      username,
      threadRoot,
      platformId,
      user?.displayName,
      post.id,  // triggeringPostId - the actual message that started the session
      initialOptions
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger?.error(`Error handling message: ${errorMessage}`);
    // Try to notify user if possible
    try {
      await client.createPost(`⚠️ An error occurred: ${errorMessage}`, threadRoot);
    } catch (postErr) {
      logSilentError('error-notification-post', postErr);
    }
  }
}
