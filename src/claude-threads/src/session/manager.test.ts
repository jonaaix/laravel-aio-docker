/**
 * Tests for session/manager.ts - SessionManager
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { SessionManager } from './manager.js';
import { SessionStore } from '../persistence/session-store.js';
import { MattermostClient } from '../platform/mattermost/client.js';
import type { PlatformClient, PlatformPost } from '../platform/index.js';
import { createMockFormatter } from '../test-utils/mock-formatter.js';
import { DEFAULT_MAX_BOT_HANDOFFS } from '../config/types.js';
import { setLogHandler } from '../utils/logger.js';
import * as path from 'path';
import * as os from 'os';

// Create mock platform client
function createMockPlatform(platformId = 'test-platform') {
  const posts: Map<string, string> = new Map();
  let postIdCounter = 1;

  const mockPlatform: any = {
    platformId,
    platformType: 'mattermost',
    displayName: 'Test Platform',
    on: mock(() => mockPlatform),
    off: mock(() => mockPlatform),
    emit: mock(() => false),
    createPost: mock(async (message: string, threadId?: string): Promise<PlatformPost> => {
      const id = `post_${postIdCounter++}`;
      posts.set(id, message);
      return {
        id,
        platformId,
        channelId: 'channel1',
        userId: 'bot',
        message,
        rootId: threadId || '',
        createAt: Date.now(),
      };
    }),
    createInteractivePost: mock(async (message: string, _reactions: string[], threadId?: string): Promise<PlatformPost> => {
      const id = `post_${postIdCounter++}`;
      posts.set(id, message);
      return {
        id,
        platformId,
        channelId: 'channel1',
        userId: 'bot',
        message,
        rootId: threadId || '',
        createAt: Date.now(),
      };
    }),
    updatePost: mock(async (postId: string, message: string): Promise<PlatformPost> => {
      posts.set(postId, message);
      return {
        id: postId,
        platformId,
        channelId: 'channel1',
        userId: 'bot',
        message,
        rootId: '',
        createAt: Date.now(),
      };
    }),
    deletePost: mock(async (_postId: string): Promise<void> => {
      // No-op
    }),
    addReaction: mock(async (_postId: string, _emoji: string): Promise<void> => {}),
    removeReaction: mock(async (_postId: string, _emoji: string): Promise<void> => {}),
    pinPost: mock(async (_postId: string): Promise<void> => {}),
    unpinPost: mock(async (_postId: string): Promise<void> => {}),
    getPinnedPosts: mock(async (): Promise<string[]> => []),
    sendTyping: mock(() => {}),
    getFormatter: () => createMockFormatter(),
    isUserAllowed: mock((username: string) => username === 'admin' || username === 'allowed-user'),
    getBotUser: mock(async () => ({ id: 'bot-id', username: 'bot', displayName: 'Bot' })),
    disconnect: mock(() => {}),
    posts,
  };

  return mockPlatform as unknown as PlatformClient & { posts: Map<string, string> };
}

describe('SessionManager', () => {
  let manager: SessionManager;
  let platform: ReturnType<typeof createMockPlatform>;
  const testSessionsPath = path.join(os.tmpdir(), `test-sessions-${Date.now()}.json`);

  beforeEach(() => {
    platform = createMockPlatform();
    manager = new SessionManager('/test/dir', true, false, 'prompt', testSessionsPath);
    manager.addPlatform('test-platform', platform as unknown as PlatformClient);
  });

  describe('constructor', () => {
    test('creates instance with default options', () => {
      const m = new SessionManager('/test');
      expect(m).toBeDefined();
    });

    test('creates instance with all options', () => {
      const m = new SessionManager('/test', false, true, 'require', '/tmp/sessions.json');
      expect(m).toBeDefined();
    });

    test('respondOnlyWhenMentioned defaults to false in the session config (#402)', () => {
      const m = new SessionManager('/test');
      expect(m.getContext().config.respondOnlyWhenMentioned).toBe(false);
    });

    test('respondOnlyWhenMentioned=true flows into the session config (#402)', () => {
      // Positional: workingDir, permMode, chrome, worktreeMode, sessionsPath,
      // threadLogsEnabled, retentionDays, limits, claudeAccounts, respondOnlyWhenMentioned.
      const m = new SessionManager(
        '/test', 'default', false, 'prompt', undefined,
        true, 30, undefined, undefined, true,
      );
      expect(m.getContext().config.respondOnlyWhenMentioned).toBe(true);
    });
  });

  describe('addPlatform / removePlatform', () => {
    test('adds platform and registers event handlers', () => {
      const newPlatform = createMockPlatform('new-platform');
      manager.addPlatform('new-platform', newPlatform as unknown as PlatformClient);
      expect(newPlatform.on).toHaveBeenCalled();
    });

    test('removes platform', () => {
      manager.removePlatform('test-platform');
      // No error should be thrown
    });

    test('exposes the per-platform workingDir override (undefined when not set)', () => {
      const p = createMockPlatform('wd-platform');
      // 6th/7th addPlatform args: description, workingDir.
      manager.addPlatform('wd-platform', p as unknown as PlatformClient, undefined, 'claude', undefined, undefined, '/srv/design-bot');
      const ops = manager.getContext().ops;
      expect(ops.getPlatformWorkingDir('wd-platform')).toBe('/srv/design-bot');
      expect(ops.getPlatformWorkingDir('test-platform')).toBeUndefined();
    });
  });

  describe('isSessionActive', () => {
    test('returns false when no sessions', () => {
      expect(manager.isSessionActive()).toBe(false);
    });
  });

  describe('isInSessionThread', () => {
    test('returns false for unknown thread', () => {
      expect(manager.isInSessionThread('unknown-thread')).toBe(false);
    });
  });

  describe('hasPausedSession', () => {
    test('returns false for unknown thread', () => {
      expect(manager.hasPausedSession('unknown-thread')).toBe(false);
    });
  });

  describe('getPersistedSession', () => {
    test('returns undefined for unknown thread', () => {
      expect(manager.getPersistedSession('unknown-thread')).toBeUndefined();
    });
  });

  describe('getActiveThreadIds', () => {
    test('returns empty array when no sessions', () => {
      expect(manager.getActiveThreadIds()).toEqual([]);
    });
  });

  describe('getSessionStartPostId', () => {
    test('returns undefined for unknown thread', () => {
      expect(manager.getSessionStartPostId('unknown-thread')).toBeUndefined();
    });
  });

  describe('isUserAllowedInSession', () => {
    test('returns false for unknown thread with unknown user', () => {
      expect(manager.isUserAllowedInSession('unknown-thread', 'random-user')).toBe(false);
    });
  });

  describe('hasPendingWorktreePrompt', () => {
    test('returns false for unknown thread', () => {
      expect(manager.hasPendingWorktreePrompt('unknown-thread')).toBe(false);
    });
  });

  describe('hasPendingContextPrompt', () => {
    test('returns false for unknown thread', () => {
      expect(manager.hasPendingContextPrompt('unknown-thread')).toBe(false);
    });
  });

  describe('isSessionInteractive', () => {
    test('returns false when skipPermissions is true', () => {
      // Manager was created with skipPermissions = true
      expect(manager.isSessionInteractive('unknown-thread')).toBe(false);
    });

    test('returns true when skipPermissions is false', () => {
      const m = new SessionManager('/test', false);
      expect(m.isSessionInteractive('any-thread')).toBe(true);
    });
  });

  describe('setSkipPermissions', () => {
    test('changes skipPermissions value', () => {
      manager.setSkipPermissions(false);
      // After setting to false, isSessionInteractive should return true
      expect(manager.isSessionInteractive('unknown-thread')).toBe(true);
    });
  });

  describe('setChromeEnabled', () => {
    test('changes chromeEnabled value', () => {
      manager.setChromeEnabled(true);
      // No direct getter, but should not throw
    });
  });

  describe('setShuttingDown', () => {
    test('sets shutting down flag', () => {
      manager.setShuttingDown();
      // No direct getter, but should not throw
    });
  });

  describe('session events', () => {
    test('emits session:add event', () => {
      const listener = mock(() => {});
      manager.on('session:add', listener);
      // Can't easily test without starting a session
    });

    test('emits session:update event', () => {
      const listener = mock(() => {});
      manager.on('session:update', listener);
      // Can't easily test without starting a session
    });

    test('emits session:remove event', () => {
      const listener = mock(() => {});
      manager.on('session:remove', listener);
      // Can't easily test without starting a session
    });
  });

  describe('killSession', () => {
    test('does nothing for unknown thread', async () => {
      await manager.killSession('unknown-thread');
      // Should not throw
    });
  });

  describe('killAllSessions', () => {
    test('does nothing when no sessions', () => {
      manager.killAllSessions();
      // Should not throw
    });
  });

  describe('cancelSession', () => {
    test('does nothing for unknown thread', async () => {
      await manager.cancelSession('unknown-thread', 'user');
      // Should not throw
    });
  });

  describe('interruptSession', () => {
    test('does nothing for unknown thread', async () => {
      await manager.interruptSession('unknown-thread', 'user');
      // Should not throw
    });
  });

  describe('changeDirectory', () => {
    test('does nothing for unknown thread', async () => {
      await manager.changeDirectory('unknown-thread', '/new/path', 'user');
      // Should not throw
    });
  });

  describe('inviteUser', () => {
    test('does nothing for unknown thread', async () => {
      await manager.inviteUser('unknown-thread', 'newuser', 'inviter');
      // Should not throw
    });
  });

  describe('kickUser', () => {
    test('does nothing for unknown thread', async () => {
      await manager.kickUser('unknown-thread', 'kickeduser', 'kicker');
      // Should not throw
    });
  });

  describe('enableInteractivePermissions', () => {
    test('does nothing for unknown thread', async () => {
      await manager.enableInteractivePermissions('unknown-thread', 'user');
      // Should not throw
    });
  });

  describe('requestMessageApproval', () => {
    test('does nothing for unknown thread', async () => {
      await manager.requestMessageApproval('unknown-thread', 'user', 'message');
      // Should not throw
    });
  });

  describe('sendFollowUp', () => {
    test('does nothing for unknown thread', async () => {
      await manager.sendFollowUp('unknown-thread', 'message');
      // Should not throw
    });
  });

  describe('resumePausedSession', () => {
    test('handles unknown thread gracefully', async () => {
      // This will try to find a persisted session which doesn't exist
      await manager.resumePausedSession('unknown-thread', 'message', undefined, 'someuser');
      // Should not throw - method handles missing session internally
    });
  });

  describe('worktree commands', () => {
    test('handleWorktreeBranchResponse does nothing for unknown thread', async () => {
      const result = await manager.handleWorktreeBranchResponse('unknown-thread', 'branch', 'user', 'post1');
      expect(result).toBe(false);
    });

    test('handleWorktreeSkip does nothing for unknown thread', async () => {
      await manager.handleWorktreeSkip('unknown-thread', 'user');
      // Should not throw
    });

    test('createAndSwitchToWorktree does nothing for unknown thread', async () => {
      await manager.createAndSwitchToWorktree('unknown-thread', 'branch', 'user');
      // Should not throw
    });

    test('switchToWorktree does nothing for unknown thread', async () => {
      await manager.switchToWorktree('unknown-thread', 'branch', 'user');
      // Should not throw
    });

    test('listWorktreesCommand does nothing for unknown thread', async () => {
      await manager.listWorktreesCommand('unknown-thread', 'user');
      // Should not throw
    });

    test('removeWorktreeCommand does nothing for unknown thread', async () => {
      await manager.removeWorktreeCommand('unknown-thread', 'branch', 'user');
      // Should not throw
    });

    test('disableWorktreePrompt does nothing for unknown thread', async () => {
      await manager.disableWorktreePrompt('unknown-thread', 'user');
      // Should not throw
    });
  });

  describe('postShutdownMessages', () => {
    test('does nothing when no sessions', async () => {
      await manager.postShutdownMessages();
      // Should not throw
    });
  });

  describe('shutdown', () => {
    test('shuts down gracefully with no sessions', async () => {
      await manager.shutdown('Shutting down');
      // Should not throw
    });
  });

  describe('offerContextPrompt', () => {
    test('returns false for unknown thread', async () => {
      // Can't easily test without a session, but the method requires a session object
    });
  });

  describe('pauseSessionsForPlatform', () => {
    test('does nothing when no sessions for platform', async () => {
      await manager.pauseSessionsForPlatform('test-platform');
      // Should not throw
    });
  });

  describe('resumePausedSessionsForPlatform', () => {
    test('does nothing when no paused sessions for platform', async () => {
      await manager.resumePausedSessionsForPlatform('test-platform');
      // Should not throw
    });
  });

  describe('addSideConversation', () => {
    test('does nothing for unknown thread', () => {
      // Should not throw
      manager.addSideConversation('unknown-thread', {
        fromUser: 'alice',
        mentionedUser: 'bob',
        message: 'test message',
        timestamp: new Date(),
        postId: 'post1',
      });
    });

    test('tracks side conversation for known thread', () => {
      // Create a mock session in the registry
      const mockSession = {
        threadId: 'test-thread',
        sessionId: 'test-platform:test-thread',
        pendingSideConversations: undefined as any,
      };
      // Access registry directly (it's public)
      (manager.registry as any).sessions.set('test-platform:test-thread', mockSession);

      manager.addSideConversation('test-thread', {
        fromUser: 'alice',
        mentionedUser: 'bob',
        message: 'test message',
        timestamp: new Date(),
        postId: 'post1',
      });

      expect(mockSession.pendingSideConversations).toBeDefined();
      expect(mockSession.pendingSideConversations.length).toBe(1);
      expect(mockSession.pendingSideConversations[0].fromUser).toBe('alice');
    });

    test('enforces max count limit', () => {
      const mockSession = {
        threadId: 'test-thread',
        sessionId: 'test-platform:test-thread',
        pendingSideConversations: [] as any[],
      };
      (manager.registry as any).sessions.set('test-platform:test-thread', mockSession);

      // Add 7 conversations (more than the 5 limit)
      for (let i = 0; i < 7; i++) {
        manager.addSideConversation('test-thread', {
          fromUser: `user${i}`,
          mentionedUser: 'bob',
          message: `message ${i}`,
          timestamp: new Date(),
          postId: `post${i}`,
        });
      }

      // Should only keep the last 5
      expect(mockSession.pendingSideConversations.length).toBe(5);
      expect(mockSession.pendingSideConversations[0].fromUser).toBe('user2');
      expect(mockSession.pendingSideConversations[4].fromUser).toBe('user6');
    });

    test('enforces max character limit', () => {
      const mockSession = {
        threadId: 'test-thread',
        sessionId: 'test-platform:test-thread',
        pendingSideConversations: [] as any[],
      };
      (manager.registry as any).sessions.set('test-platform:test-thread', mockSession);

      // Add conversations with 500 chars each (exceeds 2000 total after 5 messages)
      for (let i = 0; i < 5; i++) {
        manager.addSideConversation('test-thread', {
          fromUser: `user${i}`,
          mentionedUser: 'bob',
          message: 'A'.repeat(500),
          timestamp: new Date(),
          postId: `post${i}`,
        });
      }

      // Should only keep messages that fit in 2000 chars (4 messages = 2000 chars exactly)
      expect(mockSession.pendingSideConversations.length).toBe(4);
    });

    test('enforces max age limit', () => {
      const mockSession = {
        threadId: 'test-thread',
        sessionId: 'test-platform:test-thread',
        pendingSideConversations: [] as any[],
      };
      (manager.registry as any).sessions.set('test-platform:test-thread', mockSession);

      // Add an old conversation (31 minutes ago)
      const oldTimestamp = new Date(Date.now() - 31 * 60 * 1000);
      manager.addSideConversation('test-thread', {
        fromUser: 'olduser',
        mentionedUser: 'bob',
        message: 'old message',
        timestamp: oldTimestamp,
        postId: 'old-post',
      });

      // Add a recent conversation
      manager.addSideConversation('test-thread', {
        fromUser: 'newuser',
        mentionedUser: 'bob',
        message: 'new message',
        timestamp: new Date(),
        postId: 'new-post',
      });

      // Should only have the recent message (old one filtered by age)
      expect(mockSession.pendingSideConversations.length).toBe(1);
      expect(mockSession.pendingSideConversations[0].fromUser).toBe('newuser');
    });
  });

  // ==========================================================================
  // PR 1 safety net — targeted tests that exercise injected-session paths
  // ==========================================================================

  /** Inject a realistic-ish session directly into the registry. */
  function injectSession(
    mgr: SessionManager,
    platform: PlatformClient,
    threadId: string,
    overrides: Record<string, unknown> = {}
  ) {
    const sessionId = `test-platform:${threadId}`;
    const session: any = {
      platformId: 'test-platform',
      threadId,
      sessionId,
      claudeSessionId: `claude-${threadId}`,
      startedBy: 'alice',
      startedByDisplayName: 'Alice',
      startedAt: new Date(),
      lastActivityAt: new Date(),
      sessionNumber: 1,
      workingDir: '/test/dir',
      platform,
      claude: {
        isRunning: mock(() => true),
        kill: mock(() => Promise.resolve()),
        isPermanentFailure: mock(() => false),
        getPermanentFailureReason: mock(() => null),
      },
      planApproved: false,
      sessionAllowedUsers: new Set(['alice']),
      forceInteractivePermissions: false,
    respondOnlyWhenMentioned: false,
      sessionStartPostId: null,
      timers: { timeoutTimer: null, warningTimer: null, cleanupTimer: null },
      lifecycle: { state: 'active', resumeFailCount: 0, hasClaudeResponded: true },
      timeoutWarningPosted: false,
      messageCount: 0,
      messageManager: {
        getPendingContextPrompt: mock(() => null),
        getTaskListState: mock(() => ({ postId: null, content: null, isCompleted: false, isMinimized: false })),
        dispose: mock(() => {}),
      },
      ...overrides,
    };
    (mgr.registry as any).sessions.set(sessionId, session);
    return session;
  }

  describe('isSessionActive with injected session', () => {
    test('returns true when at least one session is registered', () => {
      injectSession(manager, platform as unknown as PlatformClient, 'thread-X');
      expect(manager.isSessionActive()).toBe(true);
    });
  });

  describe('isInSessionThread', () => {
    test('returns true for a registered thread', () => {
      injectSession(manager, platform as unknown as PlatformClient, 'thread-X');
      expect(manager.isInSessionThread('thread-X')).toBe(true);
    });
  });

  describe('getActiveThreadIds', () => {
    test('returns registered thread ids', () => {
      injectSession(manager, platform as unknown as PlatformClient, 'A');
      injectSession(manager, platform as unknown as PlatformClient, 'B');
      expect(manager.getActiveThreadIds().sort()).toEqual(['A', 'B']);
    });
  });

  describe('sendFollowUp platform scoping (multi-bot echo fix)', () => {
    // Two bots share one raw threadId. sendFollowUp MUST target the session on
    // the given platform — the unscoped lookup returned whichever was created
    // first, misrouting a peer's forwarded handoff back into the wrong bot's
    // session (the observed self-echo loop).
    function twoSessionsSameThread() {
      const mk = (pid: string) => ({
        platformId: pid, threadId: 'T', sessionId: `${pid}:T`,
        // isRunning=false makes sendFollowUp return right after SELECTING the
        // session, so we can assert which one was chosen without the heavy
        // lifecycle path running.
        claude: { isRunning: mock(() => false) },
      });
      const a = mk('pa');
      const b = mk('pb');
      (manager.registry as any).sessions.set('pa:T', a);
      (manager.registry as any).sessions.set('pb:T', b);
      return { a, b };
    }

    test('routes to the session on the given platform', async () => {
      const { a, b } = twoSessionsSameThread();
      await manager.sendFollowUp('T', 'hi', undefined, undefined, undefined, { platformId: 'pb' });
      expect((b.claude.isRunning as any)).toHaveBeenCalled();
      expect((a.claude.isRunning as any)).not.toHaveBeenCalled();
    });

    test('unscoped call (no platformId) keeps legacy first-match behavior', async () => {
      const { a, b } = twoSessionsSameThread();
      await manager.sendFollowUp('T', 'hi');
      expect((a.claude.isRunning as any)).toHaveBeenCalled();
      expect((b.claude.isRunning as any)).not.toHaveBeenCalled();
    });
  });

  describe('isUserAllowedInSession', () => {
    test('returns true for session owner', () => {
      injectSession(manager, platform as unknown as PlatformClient, 'thread-X', {
        sessionAllowedUsers: new Set(['alice']),
      });
      expect(manager.isUserAllowedInSession('thread-X', 'alice')).toBe(true);
    });

    test('returns true for globally-allowed user', () => {
      injectSession(manager, platform as unknown as PlatformClient, 'thread-X', {
        sessionAllowedUsers: new Set(['alice']),
      });
      expect(manager.isUserAllowedInSession('thread-X', 'admin')).toBe(true);
    });

    test('returns false for random user not invited', () => {
      injectSession(manager, platform as unknown as PlatformClient, 'thread-X', {
        sessionAllowedUsers: new Set(['alice']),
      });
      expect(manager.isUserAllowedInSession('thread-X', 'mallory')).toBe(false);
    });
  });

  describe('killSession (injected)', () => {
    test('kills an active session and drops it from registry', async () => {
      const session = injectSession(manager, platform as unknown as PlatformClient, 'thread-X');
      await manager.killSession('thread-X');
      expect(session.claude.kill).toHaveBeenCalled();
      expect((manager.registry as any).sessions.has('test-platform:thread-X')).toBe(false);
    });
  });

  describe('handleReaction (injected) — security gate', () => {
    test('ignores reactions from unauthorized users', async () => {
      const session = injectSession(manager, platform as unknown as PlatformClient, 'thread-X', {
        sessionStartPostId: 'start-post',
        sessionAllowedUsers: new Set(['alice']),
      });
      // Register the post so getSessionByPost finds it.
      (manager as any).registry.postIndex = (manager as any).registry.postIndex || new Map();
      (manager as any).registry.registerPost?.('start-post', 'thread-X', session.sessionId);
      // The test platform mock's isUserAllowed accepts 'admin'/'allowed-user'.
      // 'mallory' is NOT allowed anywhere.
      await (manager as any).handleReaction('test-platform', 'start-post', 'x', 'mallory', 'added');
      // killSession should not have been called (cancel would trigger it).
      expect(session.claude.kill).not.toHaveBeenCalled();
    });

    test('logs an audit entry when rejecting an unauthorized reaction', async () => {
      const session = injectSession(manager, platform as unknown as PlatformClient, 'thread-X', {
        sessionStartPostId: 'start-post',
        sessionAllowedUsers: new Set(['alice']),
      });
      (manager as any).registry.postIndex = (manager as any).registry.postIndex || new Map();
      (manager as any).registry.registerPost?.('start-post', 'thread-X', session.sessionId);

      // Logger emits through globalLogHandler when one is set (the UI layer
      // installs one at startup). In tests we install our own capture.
      const captured: Array<{ level: string; msg: string }> = [];
      setLogHandler((level, _component, msg) => {
        captured.push({ level, msg });
      });
      try {
        await (manager as any).handleReaction('test-platform', 'start-post', 'x', 'mallory', 'added');
      } finally {
        setLogHandler(null);
      }

      const audit = captured.find(entry => entry.msg.includes('reaction.rejected'));
      expect(audit).toBeDefined();
      expect(audit?.level).toBe('info');
      expect(audit?.msg).toContain('mallory');
    });
  });

  describe('handlePostDeleted', () => {
    test('is a no-op for unknown posts', () => {
      // Smoke test — any explicit post-delete cleanup hooks should tolerate unknown posts.
      // We simply confirm the method (if present) doesn't throw.
      if (typeof (manager as any).handlePostDeleted === 'function') {
        expect(() => (manager as any).handlePostDeleted('test-platform', 'unknown-post')).not.toThrow();
      }
    });
  });

  describe('setSkipPermissions + isSessionInteractive (injected session)', () => {
    test('forceInteractivePermissions overrides a skipPermissions=true manager', () => {
      // Fresh manager created with skipPermissions=true in outer beforeEach.
      injectSession(manager, platform as unknown as PlatformClient, 'thread-F', {
        forceInteractivePermissions: true,
      });
      expect(manager.isSessionInteractive('thread-F')).toBe(true);
    });
  });

  // ==========================================================================
  // persistSession byte-level snapshot — guarantees PR 3's refactor of
  // persistSession (use MessageManager.serialize() instead of the two per-
  // getter reaches) doesn't change the on-disk shape of `sessions.json`.
  //
  // CLAUDE.md's backward-compat rule is strict: field set must remain
  // identical to what existing users have on disk. If a PR changes the
  // byte-level shape, this test fails before the persisted state does.
  // ==========================================================================
  describe('persistSession snapshot (backward compat)', () => {
    test('persists a fully-populated session with the expected field set', () => {
      const savedCalls: Array<{ sessionId: string; data: unknown }> = [];
      // Intercept sessionStore.save to capture the written payload without
      // actually writing to disk.
      (manager as any).sessionStore.save = (sessionId: string, data: unknown) => {
        savedCalls.push({ sessionId, data });
      };

      const session = injectSession(manager, platform as unknown as PlatformClient, 'thread-snap', {
        claudeSessionId: 'claude-uuid-1',
        startedByDisplayName: 'Alice',
        sessionAllowedUsers: new Set(['alice', 'bob']),
        forceInteractivePermissions: true,
        planApproved: true,
        sessionStartPostId: 'start-1',
        messageCount: 3,
        sessionTitle: 'Test session',
        sessionDescription: 'A description',
        sessionTags: ['bug-fix'],
        pullRequestUrl: 'https://github.com/x/y/pull/1',
        lifecyclePostId: 'lifecycle-1',
        firstPrompt: 'Hello',
      });

      session.messageManager = {
        serialize: () => ({
          taskList: { postId: 'tasks-1', content: '- [ ] a', isMinimized: false, isCompleted: false },
          contextPrompt: {
            postId: 'ctx-1',
            queuedPrompt: 'followup',
            queuedFiles: undefined,
            threadMessageCount: 5,
            createdAt: 1_700_000_000_000,
            availableOptions: [],
          },
        }),
        // Keep legacy getters working as fallback if something probes them.
        getTaskListState: () => ({ postId: 'tasks-1', content: '- [ ] a', isMinimized: false, isCompleted: false }),
        getPendingContextPrompt: () => ({
          postId: 'ctx-1',
          queuedPrompt: 'followup',
          queuedFiles: undefined,
          threadMessageCount: 5,
          createdAt: 1_700_000_000_000,
          availableOptions: [],
        }),
      } as any;

      (manager as any).persistSession(session);

      expect(savedCalls).toHaveLength(1);
      const written = savedCalls[0].data as Record<string, unknown>;

      // Field set must match the pre-PR-3 shape exactly. Extra or missing
      // keys would signal schema drift.
      const expectedKeys = new Set([
        'platformId', 'threadId', 'claudeSessionId', 'startedBy', 'startedByDisplayName',
        'startedAt', 'lastActivityAt', 'sessionNumber', 'workingDir', 'planApproved',
        'sessionAllowedUsers', 'forceInteractivePermissions', 'respondOnlyWhenMentioned',
        'sessionStartPostId',
        'tasksPostId', 'lastTasksContent', 'tasksCompleted', 'tasksMinimized',
        'worktreeInfo', 'isWorktreeOwner', 'pendingWorktreePrompt', 'worktreePromptDisabled',
        'queuedPrompt', 'queuedFiles', 'firstPrompt', 'pendingContextPrompt',
        'needsContextPromptOnNextMessage', 'lifecyclePostId', 'isPaused', 'sessionTitle',
        'sessionDescription', 'sessionTags', 'pullRequestUrl', 'messageCount',
        'resumeFailCount', 'claudeAccountId', 'sessionHeaderMode',
        'agentBackend', 'opencodeSessionId', 'lastAddressedAt', 'lastSeenPostId',
      ]);
      expect(new Set(Object.keys(written))).toEqual(expectedKeys);

      // Spot-check a few critical fields — the ones sourced from
      // `MessageManager.serialize()` rather than `session.*`.
      expect(written.tasksPostId).toBe('tasks-1');
      expect(written.lastTasksContent).toBe('- [ ] a');
      expect(written.tasksCompleted).toBe(false);
      expect(written.tasksMinimized).toBe(false);
      const ctxPrompt = written.pendingContextPrompt as Record<string, unknown>;
      expect(ctxPrompt.postId).toBe('ctx-1');
      expect(ctxPrompt.queuedPrompt).toBe('followup');
      expect(written.forceInteractivePermissions).toBe(true);
      expect(written.sessionTitle).toBe('Test session');
    });

    test('persists a minimal session (no task list, no context prompt)', () => {
      const savedCalls: Array<{ sessionId: string; data: unknown }> = [];
      (manager as any).sessionStore.save = (sessionId: string, data: unknown) => {
        savedCalls.push({ sessionId, data });
      };

      const session = injectSession(manager, platform as unknown as PlatformClient, 'thread-min');
      session.messageManager = {
        serialize: () => ({
          taskList: { postId: null, content: null, isMinimized: false, isCompleted: false },
          contextPrompt: null,
        }),
        getTaskListState: () => ({ postId: null, content: null, isMinimized: false, isCompleted: false }),
        getPendingContextPrompt: () => null,
      } as any;

      (manager as any).persistSession(session);
      const written = savedCalls[0].data as Record<string, unknown>;

      // Null task-list fields: critical that we write `null`, not `undefined`.
      // Persistence readers expect these to always be present.
      expect(written.tasksPostId).toBeNull();
      expect(written.lastTasksContent).toBeNull();
      expect(written.tasksCompleted).toBe(false);
      expect(written.tasksMinimized).toBe(false);
      expect(written.pendingContextPrompt).toBeUndefined();
    });
  });

  describe('multi-bot mention routing (otherBotMentioned)', () => {
    // Regression: with two bots in one channel, @mentioning bot A must NOT make
    // bot B answer. B's addressing gate returns early iff otherBotMentioned() is
    // true from B's perspective. Uses real MattermostClient mention detection.
    function twoBotManager() {
      const m = new SessionManager('/test', 'default', false, 'off', testSessionsPath);
      const mk = (id: string, botName: string) =>
        new MattermostClient({
          id, type: 'mattermost', displayName: id,
          url: 'https://x', token: `t-${id}`, channelId: 'chan-1', botName,
          allowedUsers: [], skipPermissions: false,
        } as unknown as ConstructorParameters<typeof MattermostClient>[0]);
      m.addPlatform('mattermost', mk('mattermost', 'claude_bot_jg') as unknown as PlatformClient, undefined, 'claude');
      m.addPlatform('mattermost-lmstudio', mk('mattermost-lmstudio', 'peer-bot-2') as unknown as PlatformClient, undefined, 'claude');
      return m;
    }

    test('@mentioning one bot flags the OTHER bot to stay silent', () => {
      const m = twoBotManager();
      // "@claude_bot_jg hey" — from peer-bot-2's platform, the other bot IS mentioned → true.
      expect(m.otherBotMentioned('@claude_bot_jg hey', 'mattermost-lmstudio')).toBe(true);
      // From claude's own platform, no OTHER bot is mentioned → false (claude answers).
      expect(m.otherBotMentioned('@claude_bot_jg hey', 'mattermost')).toBe(false);
    });

    test('a bold-wrapped mention still flags the other bot (handoff robustness)', () => {
      const m = twoBotManager();
      expect(m.otherBotMentioned('**@claude_bot_jg** your turn', 'mattermost-lmstudio')).toBe(true);
    });

    test('isBotUsername recognizes every registered bot account', () => {
      const m = twoBotManager();
      expect(m.isBotUsername('claude_bot_jg')).toBe(true);
      expect(m.isBotUsername('peer-bot-2')).toBe(true);
      expect(m.isBotUsername('alice')).toBe(false);
    });
  });

  describe('multi-bot baton ("Stab") coordination', () => {
    // Two peer bots sharing one channel (same url + channelId) plus one bot in a
    // DIFFERENT channel, to exercise peer-scoping. Each gets its own sessions
    // file so persistence assertions don't cross-contaminate.
    function batonManager(cap: number = DEFAULT_MAX_BOT_HANDOFFS) {
      const sessionsPath = path.join(os.tmpdir(), `baton-${Date.now()}-${Math.floor(performance.now())}.json`);
      const m = new SessionManager('/test', 'default', false, 'off', sessionsPath, true, 30, undefined, undefined, false, cap);
      const mk = (id: string, botName: string, channelId: string) =>
        new MattermostClient({
          id, type: 'mattermost', displayName: id,
          url: 'https://x', token: `t-${id}`, channelId, botName,
          allowedUsers: [], skipPermissions: false,
        } as unknown as ConstructorParameters<typeof MattermostClient>[0]);
      m.addPlatform('bot-a', mk('bot-a', 'claude_a', 'chan-1') as unknown as PlatformClient, undefined, 'claude');
      m.addPlatform('bot-b', mk('bot-b', 'claude_b', 'chan-1') as unknown as PlatformClient, undefined, 'claude');
      // Different channel → NOT a peer of bot-a/bot-b.
      m.addPlatform('bot-c', mk('bot-c', 'claude_c', 'chan-2') as unknown as PlatformClient, undefined, 'claude');
      return { m, sessionsPath };
    }

    describe('resolveMentionedBot', () => {
      test('returns self when this bot is @mentioned', () => {
        const { m } = batonManager();
        expect(m.resolveMentionedBot('@claude_a hi', 'bot-a')).toBe('bot-a');
      });

      test('returns the peer when a peer bot is @mentioned', () => {
        const { m } = batonManager();
        expect(m.resolveMentionedBot('@claude_b please help', 'bot-a')).toBe('bot-b');
      });

      test('returns undefined for a plain message (no bot mentioned)', () => {
        const { m } = batonManager();
        expect(m.resolveMentionedBot('just a normal message', 'bot-a')).toBeUndefined();
      });

      test('multiple bots mentioned: the FIRST in the text wins (one winner)', () => {
        const { m } = batonManager();
        // "@claude_a @claude_b" → claude_a is first → bot-a, regardless of caller.
        expect(m.resolveMentionedBot('@claude_a @claude_b both of you', 'bot-a')).toBe('bot-a');
        expect(m.resolveMentionedBot('@claude_a @claude_b both of you', 'bot-b')).toBe('bot-a');
        // Reversed order in the text → the peer (bot-b) wins, even from bot-a's view.
        expect(m.resolveMentionedBot('@claude_b @claude_a both of you', 'bot-a')).toBe('bot-b');
        expect(m.resolveMentionedBot('@claude_b @claude_a both of you', 'bot-b')).toBe('bot-b');
      });

      test('every peer computes the SAME winner for a multi-mention message', () => {
        const { m } = batonManager();
        const msg = 'hey @claude_b can you and @claude_a look at this';
        // bot-b mentioned first → all three bots agree on bot-b.
        expect(m.resolveMentionedBot(msg, 'bot-a')).toBe('bot-b');
        expect(m.resolveMentionedBot(msg, 'bot-b')).toBe('bot-b');
        expect(m.resolveMentionedBot(msg, 'bot-c')).toBeUndefined(); // bot-c is in another channel
      });

      test('does not resolve a bot in a different channel (peer-scoped)', () => {
        const { m } = batonManager();
        // bot-c is @mentioned, but it is not a peer of bot-a (different channel).
        expect(m.resolveMentionedBot('@claude_c hey', 'bot-a')).toBeUndefined();
      });

      test('treats bots as peers despite a cosmetic URL difference (trailing slash / case)', () => {
        // Regression: exact url comparison broke peer detection when configs
        // differed only by a trailing slash — silently disabling all multi-bot
        // behavior (baton scoping, header hide, auto-seed context).
        const m = new SessionManager('/test', 'default', false, 'off', testSessionsPath);
        const mk = (id: string, botName: string, url: string) =>
          new MattermostClient({
            id, type: 'mattermost', displayName: id,
            url, token: `t-${id}`, channelId: 'chan-1', botName,
            allowedUsers: [], skipPermissions: false,
          } as unknown as ConstructorParameters<typeof MattermostClient>[0]);
        m.addPlatform('bot-a', mk('bot-a', 'claude_a', 'https://x') as unknown as PlatformClient, undefined, 'claude');
        m.addPlatform('bot-b', mk('bot-b', 'claude_b', 'https://X/') as unknown as PlatformClient, undefined, 'claude');

        expect(m.getPeerBotNames('bot-a')).toEqual(['claude_b']);
        expect(m.resolveMentionedBot('@claude_b hi', 'bot-a')).toBe('bot-b');
      });
    });

    describe('resolveHandoffTarget', () => {
      test('resolves the peer from the explicit turn-signal sentence', () => {
        const { m } = batonManager();
        expect(m.resolveHandoffTarget("Prod uses Postgres. @claude_b it's your turn.", 'bot-a')).toBe('bot-b');
      });

      test('accepts all spellings: it is / its / curly apostrophe, any case & punctuation', () => {
        const { m } = batonManager();
        expect(m.resolveHandoffTarget('@claude_b it is your turn', 'bot-a')).toBe('bot-b');
        expect(m.resolveHandoffTarget('@claude_b its your turn!', 'bot-a')).toBe('bot-b');
        expect(m.resolveHandoffTarget('@claude_b it’s your turn.', 'bot-a')).toBe('bot-b');
        expect(m.resolveHandoffTarget('@claude_b IT’S YOUR TURN', 'bot-a')).toBe('bot-b');
        expect(m.resolveHandoffTarget('@claude_b, it is your turn.', 'bot-a')).toBe('bot-b');
      });

      test('a bare peer mention WITHOUT the sentence does not hand off', () => {
        const { m } = batonManager();
        expect(m.resolveHandoffTarget('As @claude_b noted, prod uses Postgres.', 'bot-a')).toBeUndefined();
      });

      test('a turn-signal to a non-peer (e.g. the user) does not hand off', () => {
        const { m } = batonManager();
        expect(m.resolveHandoffTarget("@some_user it's your turn.", 'bot-a')).toBeUndefined();
      });

      test('a turn-signal to a bot in another channel does not hand off (peer-scoped)', () => {
        const { m } = batonManager();
        expect(m.resolveHandoffTarget("@claude_c it's your turn.", 'bot-a')).toBeUndefined();
      });

      test('a turn-signal aimed at self does not hand off', () => {
        const { m } = batonManager();
        expect(m.resolveHandoffTarget("@claude_a it's your turn.", 'bot-a')).toBeUndefined();
      });

      test('on several turn-signals, the last peer wins', () => {
        const { m } = batonManager();
        // First hands to a self/non-peer, then to the real peer → peer wins.
        expect(m.resolveHandoffTarget("@claude_a it's your turn. wait — @claude_b it's your turn.", 'bot-a')).toBe('bot-b');
      });
    });

    describe('transferBaton / getBatonHolder', () => {
      test('transfers the baton and reports the new holder', () => {
        const { m } = batonManager();
        expect(m.getBatonHolder('thread-1')).toBeUndefined();
        m.transferBaton('thread-1', 'bot-a');
        expect(m.getBatonHolder('thread-1')).toBe('bot-a');
        m.transferBaton('thread-1', 'bot-b');
        expect(m.getBatonHolder('thread-1')).toBe('bot-b');
      });

      test('persists baton state (survives a fresh store read)', () => {
        const { m, sessionsPath } = batonManager();
        m.transferBaton('thread-1', 'bot-a');
        const persisted = new SessionStore(sessionsPath).getThreadCoordination().get('thread-1');
        expect(persisted?.batonHolder).toBe('bot-a');
        expect(persisted?.mainBot).toBe('bot-a'); // set on first touch
      });

      test('keeps mainBot fixed and accumulates participants across transfers', () => {
        const { m, sessionsPath } = batonManager();
        m.transferBaton('thread-1', 'bot-a');
        m.transferBaton('thread-1', 'bot-b');
        m.transferBaton('thread-1', 'bot-a'); // baton returns to a
        expect(m.getBatonHolder('thread-1')).toBe('bot-a');
        const coord = new SessionStore(sessionsPath).getThreadCoordination().get('thread-1');
        expect(coord?.mainBot).toBe('bot-a'); // first-touch main is preserved
        expect([...(coord?.participants ?? [])].sort()).toEqual(['bot-a', 'bot-b']);
      });
    });

    describe('seedBatonFromFloor', () => {
      test('returns undefined and sets nothing when no session exists in the thread', () => {
        const { m } = batonManager();
        expect(m.seedBatonFromFloor('thread-x')).toBeUndefined();
        expect(m.getBatonHolder('thread-x')).toBeUndefined();
      });

      test('returns the existing explicit holder without re-deriving', () => {
        const { m } = batonManager();
        m.transferBaton('thread-1', 'bot-b');
        expect(m.seedBatonFromFloor('thread-1')).toBe('bot-b');
      });
    });

    describe('peerBotsPresent', () => {
      test('true for a bot that shares its channel with a peer', () => {
        const { m } = batonManager();
        expect(m.peerBotsPresent('bot-a')).toBe(true);
      });

      test('false for a bot alone in its channel', () => {
        const { m } = batonManager();
        expect(m.peerBotsPresent('bot-c')).toBe(false);
      });
    });

    describe('dispatchBotHandoff', () => {
      test('no-op when the target platform is unknown', async () => {
        const { m } = batonManager();
        await m.dispatchBotHandoff('thread-1', 'bot-a', 'does-not-exist');
        expect(m.getBatonHolder('thread-1')).toBeUndefined();
      });

      test('pauses and does NOT transfer when the bot-to-bot cap is reached', async () => {
        const { m } = batonManager(2);
        const author = (m as unknown as { platforms: Map<string, PlatformClient> }).platforms.get('bot-a')!;
        const posted: string[] = [];
        (author as unknown as { createPost: unknown }).createPost = mock(async (msg: string) => { posted.push(msg); return { id: 'x' }; });
        (author as unknown as { getThreadHistory: unknown }).getThreadHistory = mock(async () => { throw new Error('history must not be fetched at the cap'); });

        // Drive the hop counter to the cap (2).
        m.transferBaton('thread-1', 'bot-b', { byBot: true });
        m.transferBaton('thread-1', 'bot-a', { byBot: true });
        expect(m.botHandoffLimitReached('thread-1')).toBe(true);
        const holderBefore = m.getBatonHolder('thread-1');

        await m.dispatchBotHandoff('thread-1', 'bot-a', 'bot-b');

        expect(posted.join(' ').toLowerCase()).toContain('paused');
        expect(m.getBatonHolder('thread-1')).toBe(holderBefore); // unchanged
      });

      test('does nothing when the author has no visible handoff post', async () => {
        const { m } = batonManager();
        (m as unknown as { handoffLookupDelayMs: number }).handoffLookupDelayMs = 0; // don't sleep in tests
        const peer = (m as unknown as { platforms: Map<string, PlatformClient> }).platforms.get('bot-b')!;
        (peer as unknown as { getThreadHistory: unknown }).getThreadHistory = mock(async () => []);

        await m.dispatchBotHandoff('thread-1', 'bot-a', 'bot-b');

        expect(m.getBatonHolder('thread-1')).toBeUndefined(); // baton untouched
      });

      test('retries the history lookup when the handoff post is not persisted yet', async () => {
        // Race: the author's post is not in the thread on the first fetch but
        // appears on a later one. Without the retry the handoff is dropped.
        const { m } = batonManager();
        (m as unknown as { handoffLookupDelayMs: number }).handoffLookupDelayMs = 0;
        const peer = (m as unknown as { platforms: Map<string, PlatformClient> }).platforms.get('bot-b')!;
        let calls = 0;
        (peer as unknown as { getThreadHistory: unknown }).getThreadHistory = mock(async () => {
          calls++;
          return calls >= 2
            ? [{ id: 'h1', username: 'claude_a', message: "@claude_b it's your turn.", createAt: 1 }]
            : [];
        });
        (peer as unknown as { isUserAllowed: unknown }).isUserAllowed = mock(() => false);
        (peer as unknown as { createPost: unknown }).createPost = mock(async () => ({ id: 'x' }));

        await m.dispatchBotHandoff('thread-1', 'bot-a', 'bot-b');

        expect(calls).toBeGreaterThanOrEqual(2); // re-fetched after the empty first result
        expect(m.getBatonHolder('thread-1')).toBe('bot-b');
      });

      test('transfers the baton to the peer the author @mentioned at turn end', async () => {
        const { m } = batonManager();
        const peer = (m as unknown as { platforms: Map<string, PlatformClient> }).platforms.get('bot-b')!;
        // Author (claude_a) @mentioned the peer (claude_b) in its own output.
        (peer as unknown as { getThreadHistory: unknown }).getThreadHistory = mock(async () => [
          { id: 'h1', username: 'claude_a', message: '@claude_b what does prod use?', createAt: 1 },
        ]);
        // Stop the replayed handleMessage before it spawns Claude: an unauthorized
        // author just gets a "not authorized" notice (swallowed by createPost).
        (peer as unknown as { isUserAllowed: unknown }).isUserAllowed = mock(() => false);
        (peer as unknown as { createPost: unknown }).createPost = mock(async () => ({ id: 'x' }));

        await m.dispatchBotHandoff('thread-1', 'bot-a', 'bot-b');

        expect(m.getBatonHolder('thread-1')).toBe('bot-b');
      });
    });

    describe('bot-to-bot loop budget', () => {
      // These operate purely on the coordination map + store, so a bare manager
      // (no platforms) is enough. The 11th ctor arg is maxBotHandoffs.
      const mgrWithCap = (cap: number) => new SessionManager(
        '/test', 'default', false, 'off',
        path.join(os.tmpdir(), `baton-cap-${Date.now()}-${Math.floor(performance.now())}-${cap}.json`),
        true, 30, undefined, undefined, false, cap,
      );

      test('byBot handoffs increment the hop counter; seeds/user transfers do not', () => {
        const m = mgrWithCap(25);
        m.transferBaton('T', 'a');                    // seed, not a bot handoff
        expect(m.getBotHops('T')).toBe(0);
        m.transferBaton('T', 'b', { byBot: true });
        m.transferBaton('T', 'a', { byBot: true });
        expect(m.getBotHops('T')).toBe(2);
      });

      test('noteUserActivity resets the hop counter', () => {
        const m = mgrWithCap(25);
        m.transferBaton('T', 'a', { byBot: true });
        m.transferBaton('T', 'b', { byBot: true });
        expect(m.getBotHops('T')).toBe(2);
        m.noteUserActivity('T');
        expect(m.getBotHops('T')).toBe(0);
      });

      test('botHandoffLimitReached fires at the cap and clears after user activity', () => {
        const m = mgrWithCap(2);
        m.transferBaton('T', 'a');
        expect(m.botHandoffLimitReached('T')).toBe(false);
        m.transferBaton('T', 'b', { byBot: true }); // 1
        expect(m.botHandoffLimitReached('T')).toBe(false);
        m.transferBaton('T', 'a', { byBot: true }); // 2 → reached
        expect(m.botHandoffLimitReached('T')).toBe(true);
        m.noteUserActivity('T');
        expect(m.botHandoffLimitReached('T')).toBe(false);
      });

      test('a cap of 0 disables the limit entirely', () => {
        const m = mgrWithCap(0);
        m.transferBaton('T', 'a', { byBot: true });
        m.transferBaton('T', 'b', { byBot: true });
        expect(m.getMaxBotHandoffs()).toBe(0);
        expect(m.botHandoffLimitReached('T')).toBe(false);
      });
    });
  });
});
