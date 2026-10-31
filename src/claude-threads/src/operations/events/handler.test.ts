/**
 * Tests for events.ts - Pre/post processing and session-specific side effects
 *
 * NOTE: Main event handling (formatting, tool handling) is now tested in
 * src/operations/ tests. This file tests session-specific side effects that
 * wrap the MessageManager.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import {
  handleEventPreProcessing,
  handleEventPostProcessing,
} from './handler.js';
import type { SessionContext } from '../session-context/index.js';
import type { Session } from '../../session/types.js';
import { createSessionTimers, createSessionLifecycle } from '../../session/types.js';
import type { PlatformClient, PlatformPost } from '../../platform/index.js';
import { createMockFormatter } from '../../test-utils/mock-formatter.js';

// Mock platform client
function createMockPlatform() {
  const posts: Map<string, string> = new Map();
  let postIdCounter = 1;

  const mockPlatform = {
    getBotUser: mock(async () => ({
      id: 'bot',
      username: 'bot',
      displayName: 'Bot',
    })),
    createPost: mock(async (message: string, _threadId?: string): Promise<PlatformPost> => {
      const id = `post_${postIdCounter++}`;
      posts.set(id, message);
      return {
        id,
        platformId: 'test',
        channelId: 'channel1',
        userId: 'bot',
        message,
        rootId: _threadId || '',
        createAt: Date.now(),
      };
    }),
    updatePost: mock(async (postId: string, message: string): Promise<PlatformPost> => {
      posts.set(postId, message);
      return {
        id: postId,
        platformId: 'test',
        channelId: 'channel1',
        userId: 'bot',
        message,
        rootId: '',
        createAt: Date.now(),
      };
    }),
    deletePost: mock(async (postId: string): Promise<void> => {
      posts.delete(postId);
    }),
    createInteractivePost: mock(async (message: string, _reactions: string[], _threadId?: string): Promise<PlatformPost> => {
      const id = `post_${postIdCounter++}`;
      posts.set(id, message);
      return {
        id,
        platformId: 'test',
        channelId: 'channel1',
        userId: 'bot',
        message,
        rootId: _threadId || '',
        createAt: Date.now(),
      };
    }),
    pinPost: mock(async (_postId: string): Promise<void> => {}),
    unpinPost: mock(async (_postId: string): Promise<void> => {}),
    addReaction: mock(async (_postId: string, _emoji: string): Promise<void> => {}),
    removeReaction: mock(async (_postId: string, _emoji: string): Promise<void> => {}),
    sendTyping: mock(() => {}),
    getFormatter: () => createMockFormatter(),
    getThreadHistory: mock(async (_threadId: string, _options?: { limit?: number }) => {
      return [];
    }),
    posts,
  };

  return mockPlatform as unknown as PlatformClient & { posts: Map<string, string> };
}

// Create a minimal session for testing
function createTestSession(platform: PlatformClient): Session {
  return {
    platformId: 'test',
    threadId: 'thread1',
    sessionId: 'test:thread1',
    claudeSessionId: 'uuid-123',
    startedBy: 'testuser',
    startedAt: new Date(),
    lastActivityAt: new Date(),
    sessionNumber: 1,
    platform,
    workingDir: '/test',
    claude: {
      isRunning: () => true,
      sendMessage: mock(() => {}),
      getStatusData: () => null,
    } as any,
    planApproved: false,
    sessionAllowedUsers: new Set(['testuser']),
    forceInteractivePermissions: false,
    respondOnlyWhenMentioned: false,
    sessionStartPostId: 'start_post',
    sessionHeaderMode: 'full',
    timers: createSessionTimers(),
    lifecycle: createSessionLifecycle(),
    timeoutWarningPosted: false,
    messageCount: 0,
    isProcessing: false,
    recentEvents: [],
    messageManager: undefined,
  };
}

function createSessionContext(): SessionContext {
  return {
    config: {
      debug: false,
      workingDir: '/test',
      permissionMode: 'bypass',
      chromeEnabled: false,
      maxSessions: 5,
    },
    state: {
      sessions: new Map(),
      postIndex: new Map(),
      platforms: new Map(),
      sessionStore: { save: () => {}, remove: () => {}, load: () => new Map(), findByPostId: () => undefined, cleanStale: () => [] } as any,
      githubEmailsStore: { get: () => undefined, set: () => {}, delete: () => false } as any,
      isShuttingDown: false,
    },
    ops: {
      getSessionId: (_p, t) => t,
      findSessionByThreadId: () => undefined,
      registerPost: mock((_postId: string, _threadId: string) => {}),
      flush: mock(async (_session: Session) => {}),
      startTyping: mock((_session: Session) => {}),
      stopTyping: mock((_session: Session) => {}),
      updateStickyMessage: mock(async () => {}),
      persistSession: mock((_session: Session) => {}),
      updateSessionHeader: mock(async (_session: Session) => {}),
      unpersistSession: mock((_sessionId: string) => {}),
      buildMessageContent: mock(async (text: string) => ({ content: text, skipped: [] })),
      handleEvent: mock((_sessionId: string, _event: any) => {}),
      handleExit: mock(async (_sessionId: string, _code: number) => {}),
      killSession: mock(async (_threadId: string) => {}),
      shouldPromptForWorktree: mock(async (_session: Session) => null),
      postWorktreePrompt: mock(async (_session: Session, _reason: string) => {}),
      offerContextPrompt: mock(async (_session: Session, _queuedPrompt: string) => false),
      emitSessionAdd: mock(() => {}),
      emitSessionUpdate: mock(() => {}),
      emitSessionRemove: mock(() => {}),
      registerWorktreeUser: mock(() => {}),
      unregisterWorktreeUser: mock(() => {}),
      hasOtherSessionsUsingWorktree: mock(() => false),
      switchToWorktree: mock(async () => {}),
      forceUpdate: mock(async () => {}),
      deferUpdate: mock(() => {}),
      handleBugReportApproval: mock(async () => {}),
      acquireClaudeAccount: mock(() => null),
      getClaudeAccount: mock(() => undefined),
      releaseClaudeAccount: mock(() => {}),
      markClaudeAccountCooling: mock(() => {}),
      getClaudeAccountPoolStatus: mock(() => []),
      getPlatformOverhead: mock(() => ({ sessionHeader: 'full' as const, stickyMessage: 'full' as const })),
      getPlatformAgent: mock(() => 'claude' as const),
      getPeerBotNames: mock(() => [] as string[]),
      getPeerBots: mock(() => []),
      getPlatformModel: mock(() => undefined),
      getPlatformWorkingDir: mock(() => undefined),
      getPlatformWorkingBlock: mock(() => undefined),
      getPlatformWriteScope: mock(() => undefined),
      resolveMentionedBot: mock(() => undefined),
      resolveHandoffTarget: mock(() => undefined),
      dispatchBotHandoff: mock(() => Promise.resolve()),
    },
  };
}

describe('handleEventPreProcessing', () => {
  let platform: PlatformClient;
  let session: Session;
  let ctx: SessionContext;

  beforeEach(() => {
    platform = createMockPlatform();
    session = createTestSession(platform);
    ctx = createSessionContext();
  });

  test('resets session activity on any event', () => {
    const oldTime = new Date(Date.now() - 10000);
    session.lastActivityAt = oldTime;

    handleEventPreProcessing(session, { type: 'assistant' }, ctx);

    expect(session.lastActivityAt.getTime()).toBeGreaterThan(oldTime.getTime());
  });

  test('sets hasClaudeResponded on first assistant event', () => {
    expect(session.lifecycle.hasClaudeResponded).toBe(false);

    handleEventPreProcessing(session, { type: 'assistant' }, ctx);

    expect(session.lifecycle.hasClaudeResponded).toBe(true);
    expect(ctx.ops.persistSession).toHaveBeenCalled();
  });

  test('sets hasClaudeResponded on first tool_use event', () => {
    expect(session.lifecycle.hasClaudeResponded).toBe(false);

    handleEventPreProcessing(session, { type: 'tool_use', tool_use: { name: 'Read' } }, ctx);

    expect(session.lifecycle.hasClaudeResponded).toBe(true);
  });

  test('removes the ⏳ boot ack from the triggering post on first response', () => {
    session.bootAckPostId = 'user_post_1';

    handleEventPreProcessing(session, { type: 'assistant' }, ctx);

    expect(session.bootAckPostId).toBeNull();
    expect(platform.removeReaction).toHaveBeenCalledWith('user_post_1', 'hourglass_flowing_sand');
  });

  test('leaves the boot ack alone on non-response events', () => {
    session.bootAckPostId = 'user_post_1';

    handleEventPreProcessing(session, { type: 'system', subtype: 'init' } as any, ctx);

    expect(session.bootAckPostId).toBe('user_post_1');
    expect(platform.removeReaction).not.toHaveBeenCalled();
  });

  test('does not set hasClaudeResponded again if already set', () => {
    session.lifecycle.hasClaudeResponded = true;
    const callCount = (ctx.ops.persistSession as ReturnType<typeof mock>).mock.calls.length;

    handleEventPreProcessing(session, { type: 'assistant' }, ctx);

    // Should not persist again
    expect((ctx.ops.persistSession as ReturnType<typeof mock>).mock.calls.length).toBe(callCount);
  });

  test('captures slash_commands from init event', () => {
    expect(session.availableSlashCommands).toBeUndefined();

    const initEvent = {
      type: 'system',
      subtype: 'init',
      slash_commands: ['compact', 'context', 'cost', 'init', 'review', 'security-review'],
    };

    handleEventPreProcessing(session, initEvent, ctx);

    expect(session.availableSlashCommands).toBeDefined();
    expect(session.availableSlashCommands?.size).toBe(6);
    expect(session.availableSlashCommands?.has('compact')).toBe(true);
    expect(session.availableSlashCommands?.has('review')).toBe(true);
  });

  test('handles slash_commands with leading slashes', () => {
    const initEvent = {
      type: 'system',
      subtype: 'init',
      slash_commands: ['/compact', '/context', '/cost'],
    };

    handleEventPreProcessing(session, initEvent, ctx);

    expect(session.availableSlashCommands?.size).toBe(3);
    // Leading slashes should be stripped
    expect(session.availableSlashCommands?.has('compact')).toBe(true);
    expect(session.availableSlashCommands?.has('/compact')).toBe(false);
  });

  test('a fast failure still resolves the start post (status events in one chunk, slow platform)', async () => {
    const rawCreate = platform.createPost;
    (platform as unknown as { createPost: unknown }).createPost = mock(async (message: string, threadId?: string) => {
      await new Promise((r) => setTimeout(r, 25));
      return (rawCreate as (m: string, t?: string) => Promise<PlatformPost>)(message, threadId);
    });

    handleEventPreProcessing(session, { type: 'system', subtype: 'status', status: 'compacting' }, ctx);
    handleEventPreProcessing(session, {
      type: 'system', subtype: 'status', status: null,
      compact_result: 'failed', compact_error: 'Not enough messages to compact.',
    }, ctx);
    await new Promise((r) => setTimeout(r, 150));

    const posts = (platform as unknown as { posts: Map<string, string> }).posts;
    const compactionPosts = [...posts.values()].filter((m) => /Compact/i.test(m));
    expect(compactionPosts).toHaveLength(1);
    expect(compactionPosts[0]).toMatch(/failed/i);
    expect(session.compactionPostId).toBeUndefined();
  });

  test('compact failure updates the compaction post instead of leaving it stale', async () => {
    handleEventPreProcessing(session, { type: 'system', subtype: 'status', status: 'compacting' }, ctx);
    await new Promise((r) => setTimeout(r, 10));
    expect(session.compactionPostId).toBeDefined();
    const postId = session.compactionPostId!;

    handleEventPreProcessing(session, {
      type: 'system', subtype: 'status', status: null,
      compact_result: 'failed', compact_error: 'Not enough messages to compact.',
    }, ctx);
    await new Promise((r) => setTimeout(r, 10));

    const posts = (platform as unknown as { posts: Map<string, string> }).posts;
    expect(posts.get(postId)).toMatch(/failed/i);
    expect(posts.get(postId)).toContain('Not enough messages to compact.');
    expect(session.compactionPostId).toBeUndefined();
  });

  test('compact completion shows pre → post token counts', async () => {
    handleEventPreProcessing(session, { type: 'system', subtype: 'status', status: 'compacting' }, ctx);
    await new Promise((r) => setTimeout(r, 10));
    const postId = session.compactionPostId!;

    handleEventPreProcessing(session, {
      type: 'system', subtype: 'compact_boundary',
      compact_metadata: { trigger: 'manual', pre_tokens: 31103, post_tokens: 2777 },
    }, ctx);
    await new Promise((r) => setTimeout(r, 10));

    const posts = (platform as unknown as { posts: Map<string, string> }).posts;
    expect(posts.get(postId)).toMatch(/31k.*→.*3k/);
    expect(session.compactionPostId).toBeUndefined();
  });

  test('auth_status with an error posts a warning to the thread', async () => {
    handleEventPreProcessing(session, {
      type: 'auth_status', isAuthenticating: false,
      output: [], error: 'OAuth token expired',
    }, ctx);
    await new Promise((r) => setTimeout(r, 10));

    const posts = (platform as unknown as { posts: Map<string, string> }).posts;
    const warning = [...posts.values()].find((m) => /OAuth token expired/.test(m));
    expect(warning).toBeDefined();
    expect(warning).toMatch(/auth/i);
  });

  test('auth_status warnings dedupe repeated identical errors', async () => {
    const ev = {
      type: 'auth_status', isAuthenticating: false,
      output: [], error: 'OAuth token expired',
    };
    handleEventPreProcessing(session, ev, ctx);
    handleEventPreProcessing(session, ev, ctx);
    handleEventPreProcessing(session, ev, ctx);
    await new Promise((r) => setTimeout(r, 10));

    const posts = (platform as unknown as { posts: Map<string, string> }).posts;
    expect([...posts.values()].filter((m) => /OAuth token expired/.test(m))).toHaveLength(1);

    handleEventPreProcessing(session, { ...ev, error: 'API key revoked' }, ctx);
    await new Promise((r) => setTimeout(r, 10));
    expect([...posts.values()].filter((m) => /API key revoked/.test(m))).toHaveLength(1);
  });

  test('auth_status without an error is log-only (no thread post)', async () => {
    handleEventPreProcessing(session, {
      type: 'auth_status', isAuthenticating: true, output: ['Refreshing credentials...'],
    }, ctx);
    await new Promise((r) => setTimeout(r, 10));

    const posts = (platform as unknown as { posts: Map<string, string> }).posts;
    expect(posts.size).toBe(0);
  });

  test('records the MCP server set from init and only re-records on change', () => {
    expect(session.mcpServersSummary).toBeUndefined();
    const init = {
      type: 'system',
      subtype: 'init',
      mcp_servers: [{ name: 'github', status: 'failed' }, { name: 'claude-threads-mcp', status: 'connected' }],
    };
    handleEventPreProcessing(session, init, ctx);
    expect(session.mcpServersSummary).toBe('claude-threads-mcp (connected), github (failed)');

    handleEventPreProcessing(session, init, ctx);
    expect(session.mcpServersSummary).toBe('claude-threads-mcp (connected), github (failed)');

    handleEventPreProcessing(session, { type: 'system', subtype: 'init', mcp_servers: [] }, ctx);
    expect(session.mcpServersSummary).toBe('none');
  });

  test('warns in the thread when claude.ai connectors are active but the platform has them off', async () => {
    (session.platform as unknown as { getMcpConfig: () => unknown }).getMcpConfig = () => ({
      type: 'mattermost', url: 'x', token: 'y', channelId: 'c', allowedUsers: [], claudeAiConnectors: false,
    });
    const createPost = session.platform.createPost as ReturnType<typeof mock>;
    const before = createPost.mock.calls.length;

    handleEventPreProcessing(session, {
      type: 'system', subtype: 'init',
      mcp_servers: [{ name: 'claude-threads-mcp', status: 'connected' }, { name: 'claude.ai Gmail', status: 'connected' }],
    }, ctx);
    await new Promise((r) => setTimeout(r, 5));

    const posted = createPost.mock.calls.slice(before).map((c) => String(c[0]));
    expect(posted.some((m) => m.includes('claude.ai connectors are active') && m.includes('claude.ai Gmail'))).toBe(true);
  });

  test('stays quiet about connectors when the platform opted in', async () => {
    (session.platform as unknown as { getMcpConfig: () => unknown }).getMcpConfig = () => ({
      type: 'mattermost', url: 'x', token: 'y', channelId: 'c', allowedUsers: [], claudeAiConnectors: true,
    });
    const createPost = session.platform.createPost as ReturnType<typeof mock>;
    const before = createPost.mock.calls.length;

    handleEventPreProcessing(session, {
      type: 'system', subtype: 'init', mcp_servers: [{ name: 'claude.ai Gmail', status: 'connected' }],
    }, ctx);
    await new Promise((r) => setTimeout(r, 5));

    expect(createPost.mock.calls.length).toBe(before);
    expect(session.mcpServersSummary).toBe('claude.ai Gmail (connected)');
  });

  test('tracks tool uses delivered as assistant content blocks, but not sidechain ones', () => {
    handleEventPreProcessing(session, {
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Bash', id: 't1', input: {} }] },
    }, ctx);
    handleEventPreProcessing(session, {
      type: 'assistant',
      parent_tool_use_id: 'parent-1',
      message: { content: [{ type: 'tool_use', name: 'Read', id: 't2', input: {} }] },
    }, ctx);

    expect(session.recentEvents.map((e) => e.summary)).toEqual(['Bash']);
  });

  test('ignores init event without slash_commands', () => {
    const initEvent = {
      type: 'system',
      subtype: 'init',
      // No slash_commands field
    };

    handleEventPreProcessing(session, initEvent, ctx);

    expect(session.availableSlashCommands).toBeUndefined();
  });
});

describe('handleEventPostProcessing', () => {
  let platform: PlatformClient;
  let session: Session;
  let ctx: SessionContext;

  beforeEach(() => {
    platform = createMockPlatform();
    session = createTestSession(platform);
    ctx = createSessionContext();
  });

  test('stops typing on result event', () => {
    handleEventPostProcessing(session, { type: 'result' }, ctx);

    expect(ctx.ops.stopTyping).toHaveBeenCalled();
    expect(session.isProcessing).toBe(false);
  });

  test('extracts PR URL from assistant text', () => {
    const event = {
      type: 'assistant' as const,
      message: {
        content: [{
          type: 'text',
          text: 'Created PR: https://github.com/user/repo/pull/123',
        }],
      },
    };

    handleEventPostProcessing(session, event, ctx);

    expect(session.pullRequestUrl).toBe('https://github.com/user/repo/pull/123');
    expect(ctx.ops.persistSession).toHaveBeenCalled();
  });

  test('does not overwrite existing PR URL', () => {
    session.pullRequestUrl = 'https://github.com/user/repo/pull/100';

    const event = {
      type: 'assistant' as const,
      message: {
        content: [{
          type: 'text',
          text: 'Created PR: https://github.com/user/repo/pull/200',
        }],
      },
    };

    handleEventPostProcessing(session, event, ctx);

    expect(session.pullRequestUrl).toBe('https://github.com/user/repo/pull/100');
  });

  describe('bot→bot handoff trigger', () => {
    test('tracks a handoff turn-signal in the bot own output as a pending handoff', () => {
      (ctx.ops.resolveHandoffTarget as ReturnType<typeof mock>).mockReturnValue('peer-platform');

      const event = {
        type: 'assistant' as const,
        message: { content: [{ type: 'text', text: "Prod uses Postgres. @peer_bot it's your turn." }] },
      };

      handleEventPostProcessing(session, event, ctx);

      expect(session.pendingHandoff).toEqual({ toPlatformId: 'peer-platform' });
    });

    test('does NOT hand off on a bare mention without the turn-signal', () => {
      // resolveHandoffTarget returns undefined unless the explicit sentence is present.
      (ctx.ops.resolveHandoffTarget as ReturnType<typeof mock>).mockReturnValue(undefined);

      const event = {
        type: 'assistant' as const,
        message: { content: [{ type: 'text', text: 'As @peer_bot noted earlier, prod uses Postgres.' }] },
      };

      handleEventPostProcessing(session, event, ctx);

      expect(session.pendingHandoff).toBeUndefined();
    });

    test('ignores a turn-signal that resolves to this bot itself', () => {
      (ctx.ops.resolveHandoffTarget as ReturnType<typeof mock>).mockReturnValue(session.platformId);

      const event = {
        type: 'assistant' as const,
        message: { content: [{ type: 'text', text: "@me it's your turn." }] },
      };

      handleEventPostProcessing(session, event, ctx);

      expect(session.pendingHandoff).toBeUndefined();
    });

    test('fires the tracked handoff at result and clears it', () => {
      session.pendingHandoff = { toPlatformId: 'peer-platform' };

      handleEventPostProcessing(session, { type: 'result' }, ctx);

      expect(ctx.ops.dispatchBotHandoff).toHaveBeenCalledWith(session.threadId, session.platformId, 'peer-platform');
      expect(session.pendingHandoff).toBeUndefined();
    });

    test('does not dispatch a handoff when none was tracked', () => {
      session.pendingHandoff = undefined;

      handleEventPostProcessing(session, { type: 'result' }, ctx);

      expect(ctx.ops.dispatchBotHandoff).not.toHaveBeenCalled();
    });
  });

  // NOTE: Subagent toggle reaction tests have been moved to subagent.test.ts
  // since that functionality is now handled by SubagentExecutor via MessageManager

  // NOTE: postCurrentQuestion tests have been removed - question posting now
  // goes through QuestionApprovalExecutor via MessageManager

  describe('turn-end persistence', () => {
    const resultEvent = { type: 'result', total_cost_usd: 0.1 };

    beforeEach(() => {
      (ctx.state.sessions as Map<string, Session>).set(session.sessionId, session);
    });

    test('result events persist AFTER the main event handling settles', async () => {
      let resolveMain!: () => void;
      const mainHandling = new Promise<void>((r) => { resolveMain = r; });

      handleEventPostProcessing(session, resultEvent, ctx, mainHandling);
      expect(ctx.ops.persistSession).not.toHaveBeenCalled();

      resolveMain();
      await new Promise((r) => setTimeout(r, 0));
      expect(ctx.ops.persistSession).toHaveBeenCalledTimes(1);
    });

    test('result events still persist when the main handling rejects', async () => {
      handleEventPostProcessing(session, resultEvent, ctx, Promise.reject(new Error('op chain blew up')));
      await new Promise((r) => setTimeout(r, 0));
      expect(ctx.ops.persistSession).toHaveBeenCalledTimes(1);
    });

    test('deferred persist is skipped when the session was torn down meanwhile', async () => {
      let resolveMain!: () => void;
      const mainHandling = new Promise<void>((r) => { resolveMain = r; });

      handleEventPostProcessing(session, resultEvent, ctx, mainHandling);
      (ctx.state.sessions as Map<string, Session>).delete(session.sessionId);

      resolveMain();
      await new Promise((r) => setTimeout(r, 0));
      expect(ctx.ops.persistSession).not.toHaveBeenCalled();
    });
  });

  describe('sidechain (subagent) events', () => {
    test('do not execute Claude commands or hand off', () => {
      ctx.ops.resolveHandoffTarget = mock(() => 'peer-bot');
      handleEventPostProcessing(session, {
        type: 'assistant',
        parent_tool_use_id: 'parent-1',
        message: { content: [{ type: 'text', text: "!cd /tmp\n@peer it's your turn." }] },
      }, ctx);

      expect(ctx.ops.resolveHandoffTarget).not.toHaveBeenCalled();
      expect(session.pendingHandoff).toBeUndefined();
    });

    test('still contribute PR URLs', () => {
      handleEventPostProcessing(session, {
        type: 'assistant',
        parent_tool_use_id: 'parent-1',
        message: { content: [{ type: 'text', text: 'Opened https://github.com/user/repo/pull/7' }] },
      }, ctx);

      expect(session.pullRequestUrl).toBe('https://github.com/user/repo/pull/7');
    });

    test('tool_result errors inside user events are tracked, sidechain ones are not', () => {
      handleEventPostProcessing(session, {
        type: 'user',
        message: { content: [{ type: 'tool_result', tool_use_id: 't1', is_error: true, content: 'boom' }] },
      }, ctx);
      handleEventPostProcessing(session, {
        type: 'user',
        parent_tool_use_id: 'parent-1',
        message: { content: [{ type: 'tool_result', tool_use_id: 't2', is_error: true, content: 'boom' }] },
      }, ctx);

      expect(session.recentEvents.filter((e) => e.type === 'tool_error')).toHaveLength(1);
    });
  });
});
