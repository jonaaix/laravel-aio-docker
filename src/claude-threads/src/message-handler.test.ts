/**
 * Tests for message-handler.ts - Core message handling logic
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { handleMessage, type MessageHandlerOptions } from './message-handler.js';
import type { PlatformClient, PlatformPost, PlatformUser } from './platform/index.js';
import type { SessionManager } from './session/index.js';
import { createMockFormatter } from './test-utils/mock-formatter.js';

// Create mock platform client
function createMockPlatform(botName = 'claude-bot') {
  const posts: Map<string, string> = new Map();
  let postIdCounter = 1;

  return {
    platformId: 'test-platform',
    createPost: mock(async (message: string, threadId?: string): Promise<PlatformPost> => {
      const id = `post_${postIdCounter++}`;
      posts.set(id, message);
      return {
        id,
        platformId: 'test',
        channelId: 'channel1',
        userId: 'bot',
        message,
        rootId: threadId || '',
        createAt: Date.now(),
      };
    }),
    isBotMentioned: mock((message: string) => message.includes(`@${botName}`)),
    extractPrompt: mock((message: string) => message.replace(new RegExp(`@${botName}\\s*`, 'gi'), '').trim()),
    isUserAllowed: mock((username: string) => username === 'allowed-user' || username === 'admin'),
    getBotName: mock(() => botName),
    getPostPermalink: mock((post: PlatformPost) => `https://mm.test/pl/${post.id}`),
    getFormatter: () => createMockFormatter(),
    disconnect: mock(() => {}),
    posts,
  } as unknown as PlatformClient & { posts: Map<string, string> };
}

// Create mock session manager
function createMockSessionManager() {
  const mockGetActiveThreadIds = mock(() => [] as string[]);
  // Registry mocks - default to not finding sessions
  const mockFindByThreadId = mock(() => undefined);
  const mockGetPersistedByThreadId = mock(() => undefined);
  return {
    // Note: isInSessionThread and hasPausedSession removed - code uses registry directly
    isUserAllowedInSession: mock(() => true),
    getActiveThreadIds: mockGetActiveThreadIds,
    registry: {
      getActiveThreadIds: mockGetActiveThreadIds,
      findByThreadId: mockFindByThreadId,
      // handleMessage now looks sessions up per-platform via find(); delegate to
      // the same underlying mock so existing findByThreadId.mockReturnValue(...)
      // setups drive both.
      find: mock((_platformId: string, _threadId: string) => mockFindByThreadId()),
      getPersistedByThreadId: mockGetPersistedByThreadId,
      // Default: no other bot has a session in the thread.
      hasSessionInThreadExcept: mock(() => false),
    },
    getPersistedSession: mock(() => undefined),
    // Multi-bot addressing helpers (default: single-bot, no baton set).
    otherBotMentioned: mock(() => false),
    isBotUsername: mock(() => false),
    getActiveBotForThread: mock(() => undefined),
    // Explicit baton ("Stab") helpers. Default: no bot @mentioned, baton unset,
    // no seed — so the gate falls through and single-bot behavior is preserved.
    resolveMentionedBot: mock(() => undefined as string | undefined),
    getBatonHolder: mock(() => undefined as string | undefined),
    transferBaton: mock(() => {}),
    seedBatonFromFloor: mock(() => undefined as string | undefined),
    peerBotsPresent: mock(() => false),
    noteUserActivity: mock(() => {}),
    botHandoffLimitReached: mock(() => false),
    getMaxBotHandoffs: mock(() => 25),
    getBotHops: mock(() => 0),
    killAllSessions: mock(async () => {}),
    cancelSession: mock(async () => {}),
    interruptSession: mock(async () => {}),
    inviteUser: mock(async () => {}),
    kickUser: mock(async () => {}),
    setRespondOnlyWhenMentioned: mock(async () => {}),
    enableInteractivePermissions: mock(async () => {}),
    setSessionPermissionMode: mock(async () => {}),
    changeDirectory: mock(async () => {}),
    listWorktreesCommand: mock(async () => {}),
    switchToWorktree: mock(async () => {}),
    removeWorktreeCommand: mock(async () => {}),
    disableWorktreePrompt: mock(async () => {}),
    cleanupWorktreeCommand: mock(async () => {}),
    createAndSwitchToWorktree: mock(async () => {}),
    hasPendingWorktreePrompt: mock(() => false),
    handleWorktreeBranchResponse: mock(async () => false),
    sendFollowUp: mock(async () => {}),
    resumePausedSession: mock(async () => {}),
    cancelPausedSession: mock(() => {}),
    startSession: mock(async () => {}),
    startSessionWithWorktree: mock(async () => {}),
    requestMessageApproval: mock(async () => {}),
    showUpdateStatusWithoutSession: mock(async () => {}),
    listWorktreesWithoutSession: mock(async () => {}),
    switchToWorktreeWithoutSession: mock(async () => {}),
  } as unknown as SessionManager;
}

describe('handleMessage', () => {
  let client: PlatformClient & { posts: Map<string, string> };
  let session: ReturnType<typeof createMockSessionManager>;
  let options: MessageHandlerOptions;

  beforeEach(() => {
    client = createMockPlatform();
    session = createMockSessionManager();
    options = {
      platformId: 'test-platform',
      logger: {
        error: mock(() => {}),
        debug: mock(() => {}),
      },
    };
  });

  describe('!kill command', () => {
    test('executes kill for authorized user', async () => {
      const onKill = mock(() => {});
      options.onKill = onKill;

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!kill',
        rootId: '',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'admin', displayName: 'Admin' };

      await handleMessage(client, session, post, user, options);

      expect(session.killAllSessions).toHaveBeenCalled();
      expect(client.disconnect).toHaveBeenCalled();
      expect(onKill).toHaveBeenCalledWith('admin');
    });

    test('rejects kill for unauthorized user', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!kill',
        rootId: '',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'random-user', displayName: 'Random' };

      await handleMessage(client, session, post, user, options);

      expect(session.killAllSessions).not.toHaveBeenCalled();
      expect(client.createPost).toHaveBeenCalled();
    });

    test('handles @mention !kill', async () => {
      const onKill = mock(() => {});
      options.onKill = onKill;

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot !kill',
        rootId: '',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'admin', displayName: 'Admin' };

      await handleMessage(client, session, post, user, options);

      expect(session.killAllSessions).toHaveBeenCalled();
    });
  });

  describe('active session thread', () => {
    beforeEach(() => {
      // Configure registry to return a session object (active session exists)
      (session.registry.findByThreadId as any).mockReturnValue({ sessionId: 'test:thread1' });
    });

    test('handles !stop command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!stop',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.cancelSession).toHaveBeenCalledWith('thread1', 'allowed-user');
    });

    test('handles !cancel command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!cancel',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.cancelSession).toHaveBeenCalled();
    });

    test('handles !escape command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!escape',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.interruptSession).toHaveBeenCalledWith('thread1', 'allowed-user');
    });

    test('handles !help command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!help',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(client.createPost).toHaveBeenCalled();
      const postContent = (client.createPost as any).mock.calls[0][0];
      expect(postContent).toContain('Commands');
    });

    test('handles !invite command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!invite @newuser',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.inviteUser).toHaveBeenCalledWith('thread1', 'newuser', 'allowed-user');
    });

    test('handles !kick command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!kick @someuser',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.kickUser).toHaveBeenCalledWith('thread1', 'someuser', 'allowed-user');
    });

    test('handles !permissions interactive', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!permissions interactive',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      // 'interactive' is the legacy alias for 'default'; the command now
      // dispatches through setSessionPermissionMode with the canonical name.
      expect(session.setSessionPermissionMode).toHaveBeenCalledWith('thread1', 'allowed-user', 'default');
    });

    test('handles !cd command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!cd /new/path',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.changeDirectory).toHaveBeenCalledWith('thread1', '/new/path', 'allowed-user');
    });

    test('handles !worktree list', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!worktree list',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.listWorktreesCommand).toHaveBeenCalledWith('thread1', 'allowed-user');
    });

    test('handles !worktree switch <branch>', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!worktree switch feature-branch',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.switchToWorktree).toHaveBeenCalledWith('thread1', 'feature-branch', 'allowed-user');
    });

    test('ignores side conversations', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@someone-else hello!',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.sendFollowUp).not.toHaveBeenCalled();
    });

    test('sends follow-up for regular messages', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'please help me with this code',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      // Content carries this message's own permalink (a handle on THIS message,
      // not the thread root) plus the triggering post id / platform.
      expect(session.sendFollowUp).toHaveBeenCalledWith(
        'thread1',
        expect.stringContaining('please help me with this code'),
        undefined, 'allowed-user', 'User',
        { triggeringPostId: 'post1', platformId: 'test-platform' },
      );
      const sentContent = (session.sendFollowUp as any).mock.calls[0][1] as string;
      expect(sentContent).toContain('message permalink');
      expect(sentContent).toContain('https://mm.test/pl/post1');
    });

    test('a bare "stop" interrupts the current answer (kill switch), does not follow up', async () => {
      const post: PlatformPost = {
        id: 'post1', platformId: 'test', channelId: 'channel1', userId: 'user1',
        message: 'stop', rootId: 'thread1', createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.interruptSession).toHaveBeenCalledWith('thread1', 'allowed-user', 'test-platform');
      expect(session.sendFollowUp).not.toHaveBeenCalled();
    });

    test('"stop" is case-insensitive and accepts the German "stopp"', async () => {
      const mk = (m: string): PlatformPost => ({
        id: 'p', platformId: 'test', channelId: 'channel1', userId: 'user1', message: m, rootId: 'thread1', createAt: Date.now(),
      });
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, mk('  STOP '), user, options);
      await handleMessage(client, session, mk('Stopp'), user, options);

      expect(session.interruptSession).toHaveBeenCalledTimes(2);
    });

    test('"stop" as part of a longer message is NOT the kill switch (sends follow-up)', async () => {
      const post: PlatformPost = {
        id: 'post1', platformId: 'test', channelId: 'channel1', userId: 'user1',
        message: 'stop using tabs and use spaces', rootId: 'thread1', createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.interruptSession).not.toHaveBeenCalled();
      expect(session.sendFollowUp).toHaveBeenCalled();
    });

    test('"stop" from an unauthorized user does not interrupt', async () => {
      (session.isUserAllowedInSession as any).mockReturnValue(false);
      const post: PlatformPost = {
        id: 'post1', platformId: 'test', channelId: 'channel1', userId: 'user1',
        message: 'stop', rootId: 'thread1', createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'outsider', displayName: 'Outsider' };

      await handleMessage(client, session, post, user, options);

      expect(session.interruptSession).not.toHaveBeenCalled();
    });

    test('a dispatched peer bot handoff is NOT sent to human approval (accepted as authorized)', async () => {
      // Bot→bot handoff replayed by SessionManager.dispatchBotHandoff
      // (dispatchedHandoff: true skips the baton gate). The peer isn't in this
      // session's allowlist, but as a bot it must be accepted, not queued for
      // approval ("Message from @OtherBot needs approval").
      (session.isUserAllowedInSession as any).mockReturnValue(false);
      (session.isBotUsername as any).mockImplementation((u: string) => u === 'peer-bot-2');

      const post: PlatformPost = {
        id: 'post1', platformId: 'test', channelId: 'channel1', userId: 'bot-b',
        message: '@claude-bot here is the info you asked for', rootId: 'thread1', createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'bot-b', username: 'peer-bot-2', displayName: 'Peer Bot' };

      await handleMessage(client, session, post, user, { ...options, dispatchedHandoff: true });

      expect(session.requestMessageApproval).not.toHaveBeenCalled();
      expect(session.sendFollowUp).toHaveBeenCalled();
    });

    test('requests approval for unauthorized user', async () => {
      (session.isUserAllowedInSession as any).mockReturnValue(false);

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'can I help?',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'outsider', displayName: 'Outsider' };

      await handleMessage(client, session, post, user, options);

      expect(session.requestMessageApproval).toHaveBeenCalledWith('thread1', 'outsider', 'can I help?');
    });
  });

  describe('quiet mode (respondOnlyWhenMentioned, #402)', () => {
    test('handles !mentions on command', async () => {
      (session.registry.findByThreadId as any).mockReturnValue({ sessionId: 'test:thread1' });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!mentions on',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.setRespondOnlyWhenMentioned).toHaveBeenCalledWith('thread1', 'allowed-user', 'on');
    });

    test('bare !mentions toggles (no arg)', async () => {
      (session.registry.findByThreadId as any).mockReturnValue({ sessionId: 'test:thread1' });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!mentions',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.setRespondOnlyWhenMentioned).toHaveBeenCalledWith('thread1', 'allowed-user', undefined);
    });

    test('when quiet mode on, ignores a reply that does not @mention the bot', async () => {
      (session.registry.findByThreadId as any).mockReturnValue({
        sessionId: 'test:thread1',
        respondOnlyWhenMentioned: true,
      });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'just chatting with a colleague here',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.sendFollowUp).not.toHaveBeenCalled();
    });

    test('when quiet mode on, responds to a reply that @mentions the bot', async () => {
      (session.registry.findByThreadId as any).mockReturnValue({
        sessionId: 'test:thread1',
        respondOnlyWhenMentioned: true,
      });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot please continue',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.sendFollowUp).toHaveBeenCalledWith('thread1', expect.stringContaining('please continue'), undefined, 'allowed-user', 'User', { triggeringPostId: 'post1', platformId: 'test-platform' });
    });

    test('when quiet mode off (default), responds to a non-mention reply', async () => {
      (session.registry.findByThreadId as any).mockReturnValue({
        sessionId: 'test:thread1',
        respondOnlyWhenMentioned: false,
      });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'keep going please',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.sendFollowUp).toHaveBeenCalledWith('thread1', expect.stringContaining('keep going please'), undefined, 'allowed-user', 'User', { triggeringPostId: 'post1', platformId: 'test-platform' });
    });

    test('when quiet mode on, a pending worktree-prompt reply is still handled (bypasses the gate)', async () => {
      // Regression for the config-default-on + worktree-prompt case: the bot
      // just asked for a branch name, so a plain reply (no @mention) must be
      // consumed even in quiet mode, not dropped by the gate.
      (session.registry.findByThreadId as any).mockReturnValue({
        sessionId: 'test:thread1',
        respondOnlyWhenMentioned: true,
      });
      (session.hasPendingWorktreePrompt as any).mockReturnValue(true);
      (session.handleWorktreeBranchResponse as any).mockResolvedValue(true);

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'feature/my-branch',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.handleWorktreeBranchResponse).toHaveBeenCalledWith(
        'thread1',
        'feature/my-branch',
        'allowed-user',
        'post1'
      );
    });

    test('when quiet mode on, !mentions off command still works (commands bypass the gate)', async () => {
      (session.registry.findByThreadId as any).mockReturnValue({
        sessionId: 'test:thread1',
        respondOnlyWhenMentioned: true,
      });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!mentions off',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.setRespondOnlyWhenMentioned).toHaveBeenCalledWith('thread1', 'allowed-user', 'off');
    });
  });

  describe('paused session', () => {
    beforeEach(() => {
      // Configure registry to return a persisted session (paused session exists).
      // platformId must match options.platformId — handleMessage now only treats
      // a paused session as resumable from its own platform.
      (session.registry.getPersistedByThreadId as any).mockReturnValue({ platformId: 'test-platform', sessionAllowedUsers: ['allowed-user'] });
      (session.getPersistedSession as any).mockReturnValue({
        sessionAllowedUsers: ['allowed-user'],
      });
    });

    test('resumes session for authorized user', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'continue please',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.resumePausedSession).toHaveBeenCalledWith('thread1', 'continue please', undefined, 'allowed-user', 'test-platform', 'post1');
    });

    test('rejects resume for unauthorized user', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'continue',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'outsider', displayName: 'Outsider' };

      await handleMessage(client, session, post, user, options);

      expect(session.resumePausedSession).not.toHaveBeenCalled();
      expect(client.createPost).toHaveBeenCalled();
    });

    test('!stop cancels paused session instead of resuming it', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!stop',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.resumePausedSession).not.toHaveBeenCalled();
      expect(session.cancelPausedSession).toHaveBeenCalledWith('thread1', 'test-platform');
      // Should post a cancellation confirmation
      const postCalls = (client.createPost as any).mock.calls;
      const lastMessage = postCalls[postCalls.length - 1]?.[0];
      expect(lastMessage).toContain('Session cancelled');
    });

    test('!cancel also cancels paused session', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!cancel',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.resumePausedSession).not.toHaveBeenCalled();
      expect(session.cancelPausedSession).toHaveBeenCalledWith('thread1', 'test-platform');
    });

    test('other commands in paused session do not resume', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!help',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.resumePausedSession).not.toHaveBeenCalled();
    });

    test('quiet mode on: a non-mention reply does not resume the paused session (#410)', async () => {
      // Regression for #410: the persisted respondOnlyWhenMentioned flag must
      // survive the idle pause. A plain reply (no @mention) should be ignored,
      // not silently resume the session like it did before the fix.
      (session.getPersistedSession as any).mockReturnValue({
        sessionAllowedUsers: ['allowed-user'],
        respondOnlyWhenMentioned: true,
      });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'just chatting with a colleague here',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.resumePausedSession).not.toHaveBeenCalled();
    });

    test('quiet mode on: an @mention reply still resumes the paused session (#410)', async () => {
      (session.getPersistedSession as any).mockReturnValue({
        sessionAllowedUsers: ['allowed-user'],
        respondOnlyWhenMentioned: true,
      });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot please continue',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.resumePausedSession).toHaveBeenCalledWith('thread1', 'please continue', undefined, 'allowed-user', 'test-platform', 'post1');
    });

    test('quiet mode off (default): a non-mention reply still resumes the paused session', async () => {
      (session.getPersistedSession as any).mockReturnValue({
        sessionAllowedUsers: ['allowed-user'],
        respondOnlyWhenMentioned: false,
      });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'continue please',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.resumePausedSession).toHaveBeenCalledWith('thread1', 'continue please', undefined, 'allowed-user', 'test-platform', 'post1');
    });
  });

  describe('new session', () => {
    test('requires @mention to start', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'help me with code',
        rootId: '',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.startSession).not.toHaveBeenCalled();
    });

    test('rejects unauthorized users', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot help',
        rootId: '',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'outsider', displayName: 'Outsider' };

      await handleMessage(client, session, post, user, options);

      expect(session.startSession).not.toHaveBeenCalled();
      expect(client.createPost).toHaveBeenCalled();
    });

    test('starts session for authorized user with @mention', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot help me with this',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.startSession).toHaveBeenCalledWith(
        { prompt: 'help me with this', files: undefined },
        'allowed-user',
        'thread1',
        'test-platform',
        'User',
        'post1',  // triggeringPostId
        {}  // initialOptions
      );
    });

    test('prompts for message when mention has no content', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.startSession).not.toHaveBeenCalled();
      expect(client.createPost).toHaveBeenCalled();
    });

    test('handles inline branch syntax "on branch X"', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot on branch feature-x help me',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.startSessionWithWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: expect.stringMatching(/help me/) }),
        'feature-x',
        'allowed-user',
        'thread1',
        'test-platform',
        'User',
        'post1',  // triggeringPostId
        {}  // initialOptions
      );
    });

    test('handles inline worktree syntax "!worktree X" with prompt', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot !worktree my-branch do something',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.startSessionWithWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: expect.stringMatching(/do something/) }),
        'my-branch',
        'allowed-user',
        'thread1',
        'test-platform',
        'User',
        'post1',  // triggeringPostId
        {}  // initialOptions
      );
    });

    test('handles !worktree branch-name WITHOUT prompt - should start session in worktree', async () => {
      // BUG: "@bot !worktree try/try" (without additional text) returns "Mention me with your request"
      // Expected: Should start a session in the worktree, possibly with empty prompt or showing worktree prompt
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot !worktree try/try',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      // Should NOT show "Mention me with your request" error
      const postCalls = (client.createPost as any).mock.calls;
      const errorPost = postCalls.find((call: string[]) => call[0].includes('Mention me with your request'));
      expect(errorPost).toBeUndefined();

      // Should start session with worktree (empty prompt is OK for worktree-only sessions)
      expect(session.startSessionWithWorktree).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: '' }),  // Empty prompt is acceptable
        'try/try',
        'allowed-user',
        'thread1',
        'test-platform',
        'User',
        'post1',
        {}
      );
    });

    test('handles !worktree switch in root message without prompt - should switch and not start session', async () => {
      // !worktree switch branch-name without additional prompt
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot !worktree switch feature-branch',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      // Should call switchToWorktreeWithoutSession (switch only, no session start)
      expect(session.switchToWorktreeWithoutSession).toHaveBeenCalledWith('test-platform', 'thread1', 'feature-branch');
      // Should NOT start a session since there's no prompt
      expect(session.startSession).not.toHaveBeenCalled();
      expect(session.startSessionWithWorktree).not.toHaveBeenCalled();
    });

    test('handles !worktree switch in root message WITH prompt - should switch and start session', async () => {
      // BUG: "@bot !worktree switch bla hi! waar ben je nu?" should switch to "bla" worktree
      // and start a session with prompt "hi! waar ben je nu?"
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot !worktree switch bla hi! waar ben je nu?',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      // Should start session with worktree "bla" and prompt "hi! waar ben je nu?"
      expect(session.startSessionWithWorktree).toHaveBeenCalledWith(
        { prompt: 'hi! waar ben je nu?', files: undefined },
        'bla',
        'allowed-user',
        'thread1',
        'test-platform',
        'User',
        'post1',
        { switchToExisting: true }  // flag to switch to existing worktree instead of creating
      );
    });

    test('handles !worktree list in root message - should list worktrees without session', async () => {
      // BUG: !worktree list in root message does nothing because listWorktreesCommand
      // requires an active session. In root message context, we need to list worktrees
      // directly without a session, or provide a way to list worktrees without session.
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot !worktree list',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      // The current behavior calls listWorktreesCommand which does nothing without session
      // We want to verify the EXPECTED behavior: worktrees should be listed to the user
      expect(session.listWorktreesWithoutSession).toHaveBeenCalledWith('test-platform', 'thread1');
      expect(session.startSession).not.toHaveBeenCalled();
      expect(session.startSessionWithWorktree).not.toHaveBeenCalled();
    });

    test('handles !worktree remove in root message', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot !worktree remove old-branch',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.removeWorktreeCommand).toHaveBeenCalledWith('thread1', 'old-branch', 'allowed-user');
      expect(session.startSessionWithWorktree).not.toHaveBeenCalled();
    });

    test('handles !worktree cleanup in root message', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot !worktree cleanup',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.cleanupWorktreeCommand).toHaveBeenCalledWith('thread1', 'allowed-user');
      expect(session.startSessionWithWorktree).not.toHaveBeenCalled();
    });

    test('handles !worktree off in root message', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot !worktree off',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.disableWorktreePrompt).toHaveBeenCalledWith('thread1', 'allowed-user');
      expect(session.startSessionWithWorktree).not.toHaveBeenCalled();
    });

    test('handles !worktree switch without branch name in root message', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot !worktree switch',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.switchToWorktree).not.toHaveBeenCalled();
      expect(client.createPost).toHaveBeenCalled();
      const postContent = (client.createPost as any).mock.calls[0][0];
      expect(postContent).toContain('Usage');
    });

    test('handles !worktree remove without branch name in root message', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot !worktree remove',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.removeWorktreeCommand).not.toHaveBeenCalled();
      expect(client.createPost).toHaveBeenCalled();
      const postContent = (client.createPost as any).mock.calls[0][0];
      expect(postContent).toContain('Usage');
    });

    // Tests for commands that work in the first message
    describe('first message commands', () => {
      test('!help in first message shows help without starting session', async () => {
        const post: PlatformPost = {
          id: 'post1',
          platformId: 'test',
          channelId: 'channel1',
          userId: 'user1',
          message: '@claude-bot !help',
          rootId: 'thread1',
          createAt: Date.now(),
        };
        const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

        await handleMessage(client, session, post, user, options);

        expect(session.startSession).not.toHaveBeenCalled();
        expect(client.createPost).toHaveBeenCalled();
        const postContent = (client.createPost as any).mock.calls[0][0];
        expect(postContent).toContain('Commands');  // Help message contains commands
      });

      test('!cd in first message passes workingDir to startSession', async () => {
        const post: PlatformPost = {
          id: 'post1',
          platformId: 'test',
          channelId: 'channel1',
          userId: 'user1',
          message: '@claude-bot !cd /tmp write a file',
          rootId: 'thread1',
          createAt: Date.now(),
        };
        const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

        await handleMessage(client, session, post, user, options);

        expect(session.startSession).toHaveBeenCalledWith(
          { prompt: 'write a file', files: undefined },
          'allowed-user',
          'thread1',
          'test-platform',
          'User',
          'post1',
          { workingDir: '/tmp' }  // initialOptions with workingDir
        );
      });

      test('!permissions interactive in first message passes forceInteractivePermissions', async () => {
        const post: PlatformPost = {
          id: 'post1',
          platformId: 'test',
          channelId: 'channel1',
          userId: 'user1',
          message: '@claude-bot !permissions interactive fix a bug',
          rootId: 'thread1',
          createAt: Date.now(),
        };
        const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

        await handleMessage(client, session, post, user, options);

        expect(session.startSession).toHaveBeenCalledWith(
          { prompt: 'fix a bug', files: undefined },
          'allowed-user',
          'thread1',
          'test-platform',
          'User',
          'post1',
          { permissionMode: 'default', forceInteractivePermissions: true }  // initialOptions with permission mode
        );
      });

      test('!update in first message shows update status without starting session', async () => {
        const post: PlatformPost = {
          id: 'post1',
          platformId: 'test',
          channelId: 'channel1',
          userId: 'user1',
          message: '@claude-bot !update',
          rootId: 'thread1',
          createAt: Date.now(),
        };
        const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

        await handleMessage(client, session, post, user, options);

        expect(session.startSession).not.toHaveBeenCalled();
        expect(session.showUpdateStatusWithoutSession).toHaveBeenCalledWith(
          'test-platform',
          'thread1'
        );
      });

      test('combined !cd and !permissions in first message', async () => {
        const post: PlatformPost = {
          id: 'post1',
          platformId: 'test',
          channelId: 'channel1',
          userId: 'user1',
          message: '@claude-bot !cd /tmp !permissions interactive do something',
          rootId: 'thread1',
          createAt: Date.now(),
        };
        const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

        await handleMessage(client, session, post, user, options);

        expect(session.startSession).toHaveBeenCalledWith(
          { prompt: 'do something', files: undefined },
          'allowed-user',
          'thread1',
          'test-platform',
          'User',
          'post1',
          { workingDir: '/tmp', permissionMode: 'default', forceInteractivePermissions: true }
        );
      });

      test('!release-notes in first message shows release notes without starting session', async () => {
        const post: PlatformPost = {
          id: 'post1',
          platformId: 'test',
          channelId: 'channel1',
          userId: 'user1',
          message: '@claude-bot !release-notes',
          rootId: 'thread1',
          createAt: Date.now(),
        };
        const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

        await handleMessage(client, session, post, user, options);

        expect(session.startSession).not.toHaveBeenCalled();
        expect(client.createPost).toHaveBeenCalled();
      });
    });
  });

  describe('error handling', () => {
    test('catches and reports errors', async () => {
      (session.startSession as any).mockRejectedValue(new Error('Test error'));

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot help',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(options.logger?.error).toHaveBeenCalled();
      expect(client.createPost).toHaveBeenCalled();
    });

    test('handles null user gracefully', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '@claude-bot help',
        rootId: 'thread1',
        createAt: Date.now(),
      };

      await handleMessage(client, session, post, null, options);

      // Should reject with "unknown" username as unauthorized
      expect(session.startSession).not.toHaveBeenCalled();
      expect(client.createPost).toHaveBeenCalled();
    });
  });

  describe('!permissions auto command', () => {
    beforeEach(() => {
      (session.registry.findByThreadId as any).mockReturnValue({ sessionId: 'test:thread1' });
    });

    test('dispatches !permissions auto through setSessionPermissionMode', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!permissions auto',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      // `auto` is a canonical mode; it should respawn Claude with --permission-mode auto.
      expect(session.setSessionPermissionMode).toHaveBeenCalledWith('thread1', 'allowed-user', 'auto');
    });

    test('dispatches !permissions bypass through setSessionPermissionMode', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!permissions bypass',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.setSessionPermissionMode).toHaveBeenCalledWith('thread1', 'allowed-user', 'bypass');
    });

    test('rejects !permissions with unknown mode', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!permissions bogus',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      // Parser regex doesn't match; command is ignored. `setSessionPermissionMode`
      // is not called.
      expect(session.setSessionPermissionMode).not.toHaveBeenCalled();
    });
  });

  describe('!worktree commands', () => {
    beforeEach(() => {
      (session.registry.findByThreadId as any).mockReturnValue({ sessionId: 'test:thread1' });
    });

    test('handles !worktree switch without branch name', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!worktree switch',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.switchToWorktree).not.toHaveBeenCalled();
      expect(client.createPost).toHaveBeenCalled();
      const postContent = (client.createPost as any).mock.calls[0][0];
      expect(postContent).toContain('Usage');
    });

    test('handles !worktree remove without branch name', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!worktree remove',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.removeWorktreeCommand).not.toHaveBeenCalled();
      expect(client.createPost).toHaveBeenCalled();
      const postContent = (client.createPost as any).mock.calls[0][0];
      expect(postContent).toContain('Usage');
    });

    test('handles !worktree off command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!worktree off',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.disableWorktreePrompt).toHaveBeenCalledWith('thread1', 'allowed-user');
    });

    test('handles !worktree cleanup command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!worktree cleanup',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.cleanupWorktreeCommand).toHaveBeenCalledWith('thread1', 'allowed-user');
    });

    test('handles !worktree remove with branch name', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!worktree remove old-branch',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.removeWorktreeCommand).toHaveBeenCalledWith('thread1', 'old-branch', 'allowed-user');
    });
  });

  describe('Claude Code slash commands', () => {
    beforeEach(() => {
      (session.registry.findByThreadId as any).mockReturnValue({ sessionId: 'test:thread1' });
    });

    test('handles !context command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!context',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.sendFollowUp).toHaveBeenCalledWith('thread1', '/context', undefined, undefined, undefined, { system: true, platformId: 'test-platform' });
    });

    test('handles !cost command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!cost',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.sendFollowUp).toHaveBeenCalledWith('thread1', '/cost', undefined, undefined, undefined, { system: true, platformId: 'test-platform' });
    });

    test('handles !compact command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!compact',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.sendFollowUp).toHaveBeenCalledWith('thread1', '/compact', undefined, undefined, undefined, { system: true, platformId: 'test-platform' });
    });

    test('does not send slash commands for unauthorized user', async () => {
      (session.isUserAllowedInSession as any).mockReturnValue(false);

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!context',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'outsider', displayName: 'Outsider' };

      await handleMessage(client, session, post, user, options);

      expect(session.sendFollowUp).not.toHaveBeenCalled();
    });

    test('handles dynamic slash commands from init event', async () => {
      // Mock session with availableSlashCommands populated from init event
      (session.registry.findByThreadId as any).mockReturnValue({
        sessionId: 'test:thread1',
        availableSlashCommands: new Set(['context', 'cost', 'compact', 'init', 'review', 'security-review']),
      });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!review',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.sendFollowUp).toHaveBeenCalledWith('thread1', '/review', undefined, undefined, undefined, { system: true, platformId: 'test-platform' });
    });

    test('handles dynamic slash commands with arguments', async () => {
      (session.registry.findByThreadId as any).mockReturnValue({
        sessionId: 'test:thread1',
        availableSlashCommands: new Set(['context', 'cost', 'compact', 'init', 'review']),
      });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!review --detailed',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.sendFollowUp).toHaveBeenCalledWith('thread1', '/review --detailed', undefined, undefined, undefined, { system: true, platformId: 'test-platform' });
    });

    test('does not pass through unknown commands', async () => {
      (session.registry.findByThreadId as any).mockReturnValue({
        sessionId: 'test:thread1',
        availableSlashCommands: new Set(['context', 'cost', 'compact']),
      });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!unknowncommand',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      // Unknown command should not be passed through
      expect(session.sendFollowUp).not.toHaveBeenCalled();
    });
  });

  describe('!plugin command', () => {
    beforeEach(() => {
      (session.registry.findByThreadId as any).mockReturnValue({ sessionId: 'test:thread1' });
      // Add mock for plugin methods
      (session as any).pluginList = mock(() => Promise.resolve());
      (session as any).pluginInstall = mock(() => Promise.resolve());
      (session as any).pluginUninstall = mock(() => Promise.resolve());
    });

    test('handles !plugin list command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!plugin list',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect((session as any).pluginList).toHaveBeenCalledWith('thread1');
    });

    test('handles !plugin without subcommand (defaults to list)', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!plugin',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect((session as any).pluginList).toHaveBeenCalledWith('thread1');
    });

    test('handles !plugin install command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!plugin install context7',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect((session as any).pluginInstall).toHaveBeenCalledWith('thread1', 'context7', 'allowed-user');
    });

    test('handles !plugin uninstall command', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!plugin uninstall context7',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect((session as any).pluginUninstall).toHaveBeenCalledWith('thread1', 'context7', 'allowed-user');
    });

    test('shows error when !plugin install missing name', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!plugin install',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(client.createPost).toHaveBeenCalled();
      expect((client.createPost as any).mock.calls[0][0]).toContain('!plugin install <plugin-name>');
    });

    test('shows error when !plugin uninstall missing name', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!plugin uninstall',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(client.createPost).toHaveBeenCalled();
      expect((client.createPost as any).mock.calls[0][0]).toContain('!plugin uninstall <plugin-name>');
    });

    test('shows error for unknown plugin subcommand', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!plugin unknown',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(client.createPost).toHaveBeenCalled();
      expect((client.createPost as any).mock.calls[0][0]).toContain('Unknown subcommand');
    });

    test('does not allow unauthorized users to use plugin commands', async () => {
      (session.isUserAllowedInSession as any).mockReturnValue(false);

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!plugin install context7',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'outsider', displayName: 'Outsider' };

      await handleMessage(client, session, post, user, options);

      expect((session as any).pluginInstall).not.toHaveBeenCalled();
    });
  });

  describe('!kill with active sessions', () => {
    test('notifies all active sessions before shutdown', async () => {
      const onKill = mock(() => {});
      options.onKill = onKill;
      (session.getActiveThreadIds as any).mockReturnValue(['thread1', 'thread2']);

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!kill',
        rootId: '',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'admin', displayName: 'Admin' };

      await handleMessage(client, session, post, user, options);

      // Should have posted: 1 confirmation to the kill thread + 2 notifications to active threads
      expect(client.createPost).toHaveBeenCalledTimes(3);
      // First call is the confirmation to the thread where !kill was issued
      expect((client.createPost as any).mock.calls[0][0]).toContain('EMERGENCY SHUTDOWN');
      expect((client.createPost as any).mock.calls[0][0]).toContain('killing 2 active sessions');
      expect(session.killAllSessions).toHaveBeenCalled();
    });

    test('posts confirmation even with no active sessions', async () => {
      const onKill = mock(() => {});
      options.onKill = onKill;
      (session.getActiveThreadIds as any).mockReturnValue([]);

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!kill',
        rootId: '',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'admin', displayName: 'Admin' };

      await handleMessage(client, session, post, user, options);

      // Should have posted confirmation even with no active sessions
      expect(client.createPost).toHaveBeenCalledTimes(1);
      expect((client.createPost as any).mock.calls[0][0]).toContain('killing 0 active sessions');
      expect(session.killAllSessions).toHaveBeenCalled();
    });

    test('does not duplicate notification when kill issued from active session thread', async () => {
      const onKill = mock(() => {});
      options.onKill = onKill;
      // The kill is issued from thread1, which is also an active session
      (session.getActiveThreadIds as any).mockReturnValue(['thread1', 'thread2']);

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!kill',
        rootId: 'thread1', // Kill issued from within an active session
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'admin', displayName: 'Admin' };

      await handleMessage(client, session, post, user, options);

      // Should have posted: 1 confirmation to thread1 + 1 notification to thread2 (not thread1 again)
      expect(client.createPost).toHaveBeenCalledTimes(2);
      // First call is the confirmation (includes session count)
      expect((client.createPost as any).mock.calls[0][0]).toContain('killing 2 active sessions');
      expect((client.createPost as any).mock.calls[0][1]).toBe('thread1');
      // Second call is notification to thread2 only
      expect((client.createPost as any).mock.calls[1][1]).toBe('thread2');
      expect(session.killAllSessions).toHaveBeenCalled();
    });

    test('continues kill even if notifying a thread fails', async () => {
      const onKill = mock(() => {});
      options.onKill = onKill;
      (session.getActiveThreadIds as any).mockReturnValue(['thread1', 'thread2']);
      // Make the first createPost call fail
      let callCount = 0;
      (client.createPost as any).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Network error');
        }
        return { id: 'post_1' };
      });

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!kill',
        rootId: '',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'admin', displayName: 'Admin' };

      await handleMessage(client, session, post, user, options);

      // Kill should still proceed
      expect(session.killAllSessions).toHaveBeenCalled();
      expect(onKill).toHaveBeenCalledWith('admin');
    });
  });

  describe('!release-notes command', () => {
    beforeEach(() => {
      (session.registry.findByThreadId as any).mockReturnValue({ sessionId: 'test:thread1' });
    });

    test('shows release notes when available', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!release-notes',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(client.createPost).toHaveBeenCalled();
      // The post should contain version info (either formatted release notes or fallback message)
      const postContent = (client.createPost as any).mock.calls[0][0];
      // Either contains "Release Notes" (formatted) or "claude-threads" (fallback)
      expect(postContent.includes('Release Notes') || postContent.includes('claude-threads')).toBe(true);
    });

    test('handles !changelog alias', async () => {
      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: '!changelog',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(client.createPost).toHaveBeenCalled();
    });
  });

  describe('pending worktree prompt', () => {
    beforeEach(() => {
      (session.registry.findByThreadId as any).mockReturnValue({ sessionId: 'test:thread1' });
      (session.hasPendingWorktreePrompt as any).mockReturnValue(true);
    });

    test('handles branch response when user is allowed', async () => {
      (session.handleWorktreeBranchResponse as any).mockResolvedValue(true);

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'feature/my-branch',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.handleWorktreeBranchResponse).toHaveBeenCalledWith(
        'thread1',
        'feature/my-branch',
        'allowed-user',
        'post1'
      );
      expect(session.sendFollowUp).not.toHaveBeenCalled();
    });

    test('falls through when branch response returns false', async () => {
      (session.handleWorktreeBranchResponse as any).mockResolvedValue(false);

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'not a valid branch response',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'allowed-user', displayName: 'User' };

      await handleMessage(client, session, post, user, options);

      expect(session.handleWorktreeBranchResponse).toHaveBeenCalled();
      // Should fall through to sendFollowUp
      expect(session.sendFollowUp).toHaveBeenCalledWith('thread1', expect.stringContaining('not a valid branch response'), undefined, 'allowed-user', 'User', { triggeringPostId: 'post1', platformId: 'test-platform' });
    });

    test('does not handle branch response for unauthorized user', async () => {
      (session.isUserAllowedInSession as any).mockReturnValue(false);

      const post: PlatformPost = {
        id: 'post1',
        platformId: 'test',
        channelId: 'channel1',
        userId: 'user1',
        message: 'feature/branch',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'outsider', displayName: 'Outsider' };

      await handleMessage(client, session, post, user, options);

      expect(session.handleWorktreeBranchResponse).not.toHaveBeenCalled();
      expect(session.requestMessageApproval).toHaveBeenCalled();
    });
  });

  describe('multi-bot channel (platform-scoped lookup)', () => {
    // Regression: with two bots in one channel, an unscoped findByThreadId let
    // bot B's platform resolve bot A's session and relay A's posts back into it
    // → infinite self-reply loop. Sessions must be looked up per-platform.
    test('does not treat another platform\'s session as this platform\'s follow-up', async () => {
      // Simulate the unscoped view returning A's session, but the scoped find()
      // only matches on platform 'A'. This message arrives on 'platform-B'.
      (session.registry.findByThreadId as any).mockReturnValue({ sessionId: 'platform-A:thread1', platformId: 'platform-A' });
      (session.registry.find as any).mockImplementation((pid: string) =>
        pid === 'platform-A' ? { sessionId: 'platform-A:thread1', platformId: 'platform-A' } : undefined,
      );

      const post: PlatformPost = {
        id: 'postX',
        platformId: 'platform-B',
        channelId: 'channel1',
        userId: 'bot-a',
        message: 'a bot reply that must not be relayed',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'bot-a', username: 'peer-bot-2' };

      await handleMessage(client, session, post, user, { platformId: 'platform-B' });

      // B has no session in this thread → no follow-up, and (no @mention of B) no new session.
      expect(session.sendFollowUp).not.toHaveBeenCalled();
      expect(session.startSession).not.toHaveBeenCalled();
    });

    test('processes the follow-up when the session belongs to this platform', async () => {
      (session.registry.find as any).mockImplementation((pid: string) =>
        pid === 'test-platform' ? { sessionId: 'test-platform:thread1', platformId: 'test-platform' } : undefined,
      );
      (session.isUserAllowedInSession as any).mockReturnValue(true);

      const post: PlatformPost = {
        id: 'postY',
        platformId: 'test-platform',
        channelId: 'channel1',
        userId: 'user1',
        message: 'a normal follow-up',
        rootId: 'thread1',
        createAt: Date.now(),
      };
      const user: PlatformUser = { id: 'user1', username: 'alice', displayName: 'Alice' };

      await handleMessage(client, session, post, user, { platformId: 'test-platform' });

      expect(session.sendFollowUp).toHaveBeenCalled();
    });
  });

  describe('multi-bot baton ("Stab") rules', () => {
    const mkPost = (message: string, _username = 'allowed-user', userId = 'u1'): PlatformPost => ({
      id: 'p', platformId: 'test-platform', channelId: 'channel1', userId, message, rootId: 'thread1', createAt: Date.now(),
    });
    const ownSession = { sessionId: 'test-platform:thread1', platformId: 'test-platform' };

    test('ignores a plain (non-@mention) message authored by another bot — breaks the A↔B loop', async () => {
      (session.isBotUsername as any).mockImplementation((u: string) => u === 'peer-bot-2');
      (session.registry.find as any).mockReturnValue(ownSession);

      await handleMessage(client, session, mkPost('here is my analysis', 'peer-bot-2', 'bot-b'), { id: 'bot-b', username: 'peer-bot-2' }, options);

      expect(session.sendFollowUp).not.toHaveBeenCalled();
    });

    test('stays silent when a PEER bot is @mentioned, and transfers the baton to it at mention time', async () => {
      (session.resolveMentionedBot as any).mockReturnValue('other-platform');
      (session.registry.find as any).mockReturnValue(ownSession);

      await handleMessage(client, session, mkPost('@peer-bot-2 please take over'), { id: 'u1', username: 'allowed-user' }, options);

      // Baton moves the moment the peer is @mentioned, regardless of author.
      expect(session.transferBaton).toHaveBeenCalledWith('thread1', 'other-platform', { byBot: false });
      expect(session.sendFollowUp).not.toHaveBeenCalled();
      expect(session.startSession).not.toHaveBeenCalled();
    });

    test('a bot-authored @peer message is discarded at receipt — no baton transfer', async () => {
      // bot1 writes "@peer-bot-2 ..." — authored by a bot. At RECEIPT every
      // bot-authored message is dropped, mention or not: the baton does NOT move
      // here. The real handoff is fired by the AUTHOR at its turn end via
      // SessionManager.dispatchBotHandoff, not from the peer's receipt of this post.
      (session.isBotUsername as any).mockImplementation((u: string) => u === 'peer-bot-1');
      (session.resolveMentionedBot as any).mockReturnValue('other-platform');
      (session.registry.find as any).mockReturnValue(ownSession);

      await handleMessage(client, session, mkPost('@peer-bot-2 what does prod use?', 'peer-bot-1', 'bot-a'), { id: 'bot-a', username: 'peer-bot-1' }, options);

      expect(session.transferBaton).not.toHaveBeenCalled();
      expect(session.sendFollowUp).not.toHaveBeenCalled();
    });

    test('stays silent on a plain follow-up when another bot holds the baton', async () => {
      (session.getBatonHolder as any).mockReturnValue('other-platform');
      (session.registry.find as any).mockReturnValue(ownSession);

      await handleMessage(client, session, mkPost('a normal follow-up'), { id: 'u1', username: 'allowed-user' }, options);

      expect(session.sendFollowUp).not.toHaveBeenCalled();
    });

    test('answers a plain follow-up when THIS bot holds the baton', async () => {
      (session.getBatonHolder as any).mockReturnValue('test-platform');
      (session.registry.find as any).mockReturnValue(ownSession);
      (session.isUserAllowedInSession as any).mockReturnValue(true);

      await handleMessage(client, session, mkPost('a normal follow-up'), { id: 'u1', username: 'allowed-user' }, options);

      expect(session.sendFollowUp).toHaveBeenCalled();
    });

    test('seeds the baton from the legacy floor when no explicit holder exists yet', async () => {
      // Pre-coordinator thread: getBatonHolder undefined → seedBatonFromFloor
      // supplies the holder. Here it resolves to this bot → we answer.
      (session.getBatonHolder as any).mockReturnValue(undefined);
      (session.seedBatonFromFloor as any).mockReturnValue('test-platform');
      (session.registry.find as any).mockReturnValue(ownSession);
      (session.isUserAllowedInSession as any).mockReturnValue(true);

      await handleMessage(client, session, mkPost('a normal follow-up'), { id: 'u1', username: 'allowed-user' }, options);

      expect(session.seedBatonFromFloor).toHaveBeenCalledWith('thread1');
      expect(session.sendFollowUp).toHaveBeenCalled();
    });

    test('stays silent on a plain follow-up when the baton is unknown but another bot shares the thread', async () => {
      // Safety net: baton unset AND seed yields nothing (e.g. mid-startup) with
      // two bots in the thread → require a fresh @mention to disambiguate.
      (session.getBatonHolder as any).mockReturnValue(undefined);
      (session.seedBatonFromFloor as any).mockReturnValue(undefined);
      (session.registry.hasSessionInThreadExcept as any).mockReturnValue(true);
      (session.registry.find as any).mockReturnValue(ownSession);

      await handleMessage(client, session, mkPost('a normal follow-up'), { id: 'u1', username: 'allowed-user' }, options);

      expect(session.sendFollowUp).not.toHaveBeenCalled();
    });

    test('an @mention of THIS bot transfers the baton to it and is processed', async () => {
      // The baton is claimed at mention time (not derived from who last answered).
      (session.resolveMentionedBot as any).mockReturnValue('test-platform');
      (session.getBatonHolder as any).mockReturnValue('other-platform'); // another bot had it
      (session.registry.find as any).mockReturnValue(ownSession);
      (session.isUserAllowedInSession as any).mockReturnValue(true);

      await handleMessage(client, session, mkPost('@claude-bot hello again'), { id: 'u1', username: 'allowed-user' }, options);

      expect(session.transferBaton).toHaveBeenCalledWith('thread1', 'test-platform', { byBot: false });
      expect(session.sendFollowUp).toHaveBeenCalled();
    });

    test('ignores a message this bot authored itself (self-echo guard)', async () => {
      // A bot's own post must never re-enter its own session (derails the turn).
      // isBotUsername is true for the bot's own name (it's a registered platform),
      // so the receipt gate drops it like any other bot-authored message.
      (session.isBotUsername as any).mockImplementation((u: string) => u === 'claude-bot');
      (session.registry.find as any).mockReturnValue(ownSession);
      (session.isUserAllowedInSession as any).mockReturnValue(true);

      // 'claude-bot' is this mock client's own botName.
      await handleMessage(client, session, mkPost('some answer', 'claude-bot', 'self'), { id: 'self', username: 'claude-bot' }, options);

      expect(session.sendFollowUp).not.toHaveBeenCalled();
      expect(session.transferBaton).not.toHaveBeenCalled();
    });

    test('a human message resets the bot-to-bot loop budget', async () => {
      (session.getBatonHolder as any).mockReturnValue('test-platform');
      (session.registry.find as any).mockReturnValue(ownSession);
      (session.isUserAllowedInSession as any).mockReturnValue(true);

      await handleMessage(client, session, mkPost('a normal follow-up'), { id: 'u1', username: 'allowed-user' }, options);

      expect(session.noteUserActivity).toHaveBeenCalledWith('thread1');
    });

    test('a bot-authored message does NOT reset the loop budget', async () => {
      (session.isBotUsername as any).mockImplementation((u: string) => u === 'claude_peer');
      (session.registry.find as any).mockReturnValue(ownSession);

      await handleMessage(client, session, mkPost('plain bot chatter', 'claude_peer', 'peer'), { id: 'peer', username: 'claude_peer' }, options);

      expect(session.noteUserActivity).not.toHaveBeenCalled();
    });

    test('passes the triggering post id to sendFollowUp (for delta-context)', async () => {
      (session.getBatonHolder as any).mockReturnValue('test-platform');
      (session.registry.find as any).mockReturnValue(ownSession);
      (session.isUserAllowedInSession as any).mockReturnValue(true);

      await handleMessage(client, session, mkPost('a normal follow-up'), { id: 'u1', username: 'allowed-user' }, options);

      expect(session.sendFollowUp).toHaveBeenCalledWith('thread1', expect.stringContaining('a normal follow-up'), undefined, 'allowed-user', undefined, { triggeringPostId: 'p', platformId: 'test-platform' });
    });
  });
});
