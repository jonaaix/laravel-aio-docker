import { describe, it, expect, mock } from 'bun:test';
import {
  getContextSelectionFromReaction,
  formatContextForClaude,
  getValidContextOptions,
  CONTEXT_OPTIONS,
  CONTEXT_PROMPT_TIMEOUT_MS,
  getThreadContextCount,
  getThreadMessagesForContext,
  updateContextPromptPost,
  computeMissedDelta,
  formatMissedMessagesForClaude,
  DELTA_MSG_CAP,
  DELTA_TRUNC,
} from './handler.js';
import type { ThreadMessage, PlatformClient, PlatformPost } from '../../platform/index.js';
import type { Session } from '../../session/types.js';
import { createMockFormatter } from '../../test-utils/mock-formatter.js';

describe('context-prompt', () => {
  describe('getValidContextOptions', () => {
    it('returns empty array for 0 messages', () => {
      expect(getValidContextOptions(0)).toEqual([]);
    });

    it('returns empty array for 2 messages (less than smallest option)', () => {
      expect(getValidContextOptions(2)).toEqual([]);
    });

    it('returns [3] for 3 messages', () => {
      expect(getValidContextOptions(3)).toEqual([3]);
    });

    it('returns [3] for 4 messages', () => {
      expect(getValidContextOptions(4)).toEqual([3]);
    });

    it('returns [3, 5] for 5 messages', () => {
      expect(getValidContextOptions(5)).toEqual([3, 5]);
    });

    it('returns [3, 5] for 8 messages', () => {
      expect(getValidContextOptions(8)).toEqual([3, 5]);
    });

    it('returns [3, 5, 10] for 10 messages', () => {
      expect(getValidContextOptions(10)).toEqual([3, 5, 10]);
    });

    it('returns [3, 5, 10] for 20 messages', () => {
      expect(getValidContextOptions(20)).toEqual([3, 5, 10]);
    });
  });

  describe('getContextSelectionFromReaction', () => {
    const standardOptions = [3, 5, 10];
    const customOptions = [3, 5, 8]; // For 8 messages

    it('returns first option for "one" emoji', () => {
      expect(getContextSelectionFromReaction('one', standardOptions)).toBe(3);
      expect(getContextSelectionFromReaction('one', customOptions)).toBe(3);
    });

    it('returns second option for "two" emoji', () => {
      expect(getContextSelectionFromReaction('two', standardOptions)).toBe(5);
      expect(getContextSelectionFromReaction('two', customOptions)).toBe(5);
    });

    it('returns third option for "three" emoji', () => {
      expect(getContextSelectionFromReaction('three', standardOptions)).toBe(10);
      expect(getContextSelectionFromReaction('three', customOptions)).toBe(8); // "All 8 messages"
    });

    it('returns 0 (no context) for denial emojis', () => {
      expect(getContextSelectionFromReaction('-1', standardOptions)).toBe(0);
      expect(getContextSelectionFromReaction('thumbsdown', standardOptions)).toBe(0);
    });

    it('returns 0 (no context) for "x" emoji', () => {
      expect(getContextSelectionFromReaction('x', standardOptions)).toBe(0);
    });

    it('returns null for invalid emojis', () => {
      expect(getContextSelectionFromReaction('heart', standardOptions)).toBe(null);
      expect(getContextSelectionFromReaction('+1', standardOptions)).toBe(null);
    });

    it('returns null for out-of-range number emojis', () => {
      const twoOptions = [3, 5];
      expect(getContextSelectionFromReaction('three', twoOptions)).toBe(null);
    });

    it('handles unicode number emojis', () => {
      expect(getContextSelectionFromReaction('1️⃣', standardOptions)).toBe(3);
      expect(getContextSelectionFromReaction('2️⃣', standardOptions)).toBe(5);
      expect(getContextSelectionFromReaction('3️⃣', standardOptions)).toBe(10);
    });
  });

  describe('formatContextForClaude', () => {
    it('returns empty string for empty messages', () => {
      expect(formatContextForClaude([])).toBe('');
    });

    it('formats single message correctly', () => {
      const messages: ThreadMessage[] = [
        {
          id: '1',
          userId: 'user1',
          username: 'alice',
          message: 'Hello world',
          createAt: Date.now(),
        },
      ];

      const result = formatContextForClaude(messages);
      expect(result).toContain('[Previous conversation in this thread:]');
      expect(result).toContain('@alice: Hello world');
      expect(result).toContain('[Current request:]');
    });

    it('formats multiple messages in order', () => {
      const messages: ThreadMessage[] = [
        {
          id: '1',
          userId: 'user1',
          username: 'alice',
          message: 'First message',
          createAt: 1000,
        },
        {
          id: '2',
          userId: 'user2',
          username: 'bob',
          message: 'Second message',
          createAt: 2000,
        },
      ];

      const result = formatContextForClaude(messages);
      expect(result).toContain('@alice: First message');
      expect(result).toContain('@bob: Second message');
      // Check order (alice before bob)
      const aliceIndex = result.indexOf('@alice');
      const bobIndex = result.indexOf('@bob');
      expect(aliceIndex).toBeLessThan(bobIndex);
    });

    it('truncates very long messages', () => {
      const longMessage = 'x'.repeat(600);
      const messages: ThreadMessage[] = [
        {
          id: '1',
          userId: 'user1',
          username: 'alice',
          message: longMessage,
          createAt: Date.now(),
        },
      ];

      const result = formatContextForClaude(messages);
      expect(result).toContain('...');
      expect(result).not.toContain(longMessage);
    });

    it('includes separator and current request header', () => {
      const messages: ThreadMessage[] = [
        {
          id: '1',
          userId: 'user1',
          username: 'alice',
          message: 'Test',
          createAt: Date.now(),
        },
      ];

      const result = formatContextForClaude(messages);
      expect(result).toContain('---');
      expect(result).toContain('[Current request:]');
    });

    it('includes previous work summary when provided', () => {
      const messages: ThreadMessage[] = [
        {
          id: '1',
          userId: 'user1',
          username: 'alice',
          message: 'Hello world',
          createAt: Date.now(),
        },
      ];
      const summary = 'User was working on implementing a new feature for authentication.';

      const result = formatContextForClaude(messages, summary);
      expect(result).toContain('[Summary of previous work (before directory change):]');
      expect(result).toContain(summary);
      expect(result).toContain('[Previous conversation in this thread:]');
      expect(result).toContain('@alice: Hello world');
      expect(result).toContain('[Current request:]');
    });

    it('includes only summary when no messages but summary provided', () => {
      const summary = 'User was debugging a bug in the payment module.';

      const result = formatContextForClaude([], summary);
      expect(result).toContain('[Summary of previous work (before directory change):]');
      expect(result).toContain(summary);
      expect(result).toContain('[Current request:]');
      expect(result).not.toContain('[Previous conversation in this thread:]');
    });

    it('places summary before messages in the output', () => {
      const messages: ThreadMessage[] = [
        {
          id: '1',
          userId: 'user1',
          username: 'alice',
          message: 'Test message',
          createAt: Date.now(),
        },
      ];
      const summary = 'Previous work summary here.';

      const result = formatContextForClaude(messages, summary);
      const summaryIndex = result.indexOf('[Summary of previous work');
      const messagesIndex = result.indexOf('[Previous conversation');
      expect(summaryIndex).toBeLessThan(messagesIndex);
    });

    it('returns empty string when no messages and no summary', () => {
      const result = formatContextForClaude([]);
      expect(result).toBe('');
    });
  });

  describe('CONTEXT_OPTIONS', () => {
    it('has exactly 3 options', () => {
      expect(CONTEXT_OPTIONS.length).toBe(3);
    });

    it('options are in ascending order', () => {
      for (let i = 1; i < CONTEXT_OPTIONS.length; i++) {
        expect(CONTEXT_OPTIONS[i]).toBeGreaterThan(CONTEXT_OPTIONS[i - 1]);
      }
    });

    it('first option is 3 messages', () => {
      expect(CONTEXT_OPTIONS[0]).toBe(3);
    });
  });

  describe('CONTEXT_PROMPT_TIMEOUT_MS', () => {
    it('is 30 seconds', () => {
      expect(CONTEXT_PROMPT_TIMEOUT_MS).toBe(30000);
    });
  });

  // Helper to create a mock session
  function createMockSession(overrides?: {
    platformOverrides?: Partial<PlatformClient>;
    sessionOverrides?: Partial<Session>;
  }): Session {
    const mockPost: PlatformPost = { id: 'post-123', message: '', userId: 'bot', platformId: 'test-platform', channelId: 'channel-123' };

    const mockPlatform: Partial<PlatformClient> = {
      platformId: 'test-platform',
      platformType: 'mattermost',
      createPost: mock(() => Promise.resolve(mockPost)),
      updatePost: mock(() => Promise.resolve(mockPost)),
      addReaction: mock(() => Promise.resolve()),
      getFormatter: mock(() => createMockFormatter()),
      getThreadHistory: mock(() => Promise.resolve([])),
      ...overrides?.platformOverrides,
    };

    return {
      sessionId: 'test:thread-123',
      threadId: 'thread-123',
      platform: mockPlatform as PlatformClient,
      claude: {
        isRunning: mock(() => true),
        kill: mock(() => Promise.resolve()),
        sendMessage: mock(() => {}),
        on: mock(() => {}),
      } as any,
      claudeSessionId: 'claude-session-1',
      owner: 'testuser',
      startedBy: 'testuser',
      startedAt: new Date(),
      lastActivityAt: new Date(),
      buffer: '',
      sessionAllowedUsers: new Set(['testuser']),
      workingDir: '/test',
      isResumed: false,
      messageCount: 0,
      skipPermissions: true,
      ...overrides?.sessionOverrides,
    } as Session;
  }

  describe('getThreadContextCount', () => {
    it('returns count of non-bot messages', async () => {
      const messages: ThreadMessage[] = [
        { id: '1', userId: 'user1', username: 'alice', message: 'Hello', createAt: 1000 },
        { id: '2', userId: 'user2', username: 'bob', message: 'Hi', createAt: 2000 },
        { id: '3', userId: 'user3', username: 'carol', message: 'Hey', createAt: 3000 },
      ];

      const session = createMockSession({
        platformOverrides: {
          getThreadHistory: mock(() => Promise.resolve(messages)),
        },
      });

      const count = await getThreadContextCount(session);
      expect(count).toBe(3);
    });

    it('excludes specified post ID from count', async () => {
      const messages: ThreadMessage[] = [
        { id: '1', userId: 'user1', username: 'alice', message: 'Hello', createAt: 1000 },
        { id: '2', userId: 'user2', username: 'bob', message: 'Hi', createAt: 2000 },
      ];

      const session = createMockSession({
        platformOverrides: {
          getThreadHistory: mock(() => Promise.resolve(messages)),
        },
      });

      const count = await getThreadContextCount(session, '1');
      expect(count).toBe(1); // Excludes post with id '1'
    });

    it('includes root message when excluding only the triggering reply', async () => {
      // Scenario: User starts session mid-thread by @mentioning the bot in a reply (id='4')
      // The thread has: root message (id='1'), two replies (id='2', '3'), and the @mention (id='4')
      // When excluding '4' (the triggering message), the root ('1') should still be included
      const messages: ThreadMessage[] = [
        { id: '1', userId: 'user1', username: 'alice', message: 'Root message', createAt: 1000 },
        { id: '2', userId: 'user2', username: 'bob', message: 'Reply 1', createAt: 2000 },
        { id: '3', userId: 'user3', username: 'carol', message: 'Reply 2', createAt: 3000 },
        { id: '4', userId: 'user4', username: 'dave', message: '@bot help me', createAt: 4000 },
      ];

      const session = createMockSession({
        platformOverrides: {
          getThreadHistory: mock(() => Promise.resolve(messages)),
        },
      });

      // Exclude only the triggering message (id='4'), NOT the root (id='1')
      const count = await getThreadContextCount(session, '4');
      expect(count).toBe(3); // Should include root (1), reply 1 (2), reply 2 (3)

      // Verify all messages except the excluded one are included
      const contextMessages = await getThreadMessagesForContext(session, 10, '4');
      expect(contextMessages.length).toBe(3);
      expect(contextMessages.map(m => m.id)).toEqual(['1', '2', '3']);
      expect(contextMessages[0].message).toBe('Root message'); // Root is included!
    });

    it('returns 0 when getThreadHistory fails', async () => {
      const session = createMockSession({
        platformOverrides: {
          getThreadHistory: mock(() => Promise.reject(new Error('API error'))),
        },
      });

      const count = await getThreadContextCount(session);
      expect(count).toBe(0);
    });

    it('returns 0 for empty thread', async () => {
      const session = createMockSession({
        platformOverrides: {
          getThreadHistory: mock(() => Promise.resolve([])),
        },
      });

      const count = await getThreadContextCount(session);
      expect(count).toBe(0);
    });
  });

  describe('getThreadMessagesForContext', () => {
    it('returns messages up to the specified limit', async () => {
      const messages: ThreadMessage[] = [
        { id: '1', userId: 'user1', username: 'alice', message: 'Hello', createAt: 1000 },
        { id: '2', userId: 'user2', username: 'bob', message: 'Hi', createAt: 2000 },
        { id: '3', userId: 'user3', username: 'carol', message: 'Hey', createAt: 3000 },
      ];

      const session = createMockSession({
        platformOverrides: {
          getThreadHistory: mock(() => Promise.resolve(messages)),
        },
      });

      const result = await getThreadMessagesForContext(session, 5);
      expect(result.length).toBe(3);
    });

    it('filters out the excluded post ID', async () => {
      const messages: ThreadMessage[] = [
        { id: '1', userId: 'user1', username: 'alice', message: 'Hello', createAt: 1000 },
        { id: '2', userId: 'user2', username: 'bob', message: 'Hi', createAt: 2000 },
      ];

      const session = createMockSession({
        platformOverrides: {
          getThreadHistory: mock(() => Promise.resolve(messages)),
        },
      });

      const result = await getThreadMessagesForContext(session, 5, '2');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('1');
    });
  });

  describe('updateContextPromptPost', () => {
    it('updates post with timeout message', async () => {
      const session = createMockSession();

      await updateContextPromptPost(session, 'post-123', 'timeout');

      expect(session.platform.updatePost).toHaveBeenCalledWith(
        'post-123',
        '⏱️ Continuing without context (no response)'
      );
    });

    it('updates post with skip message (selection = 0)', async () => {
      const session = createMockSession();

      await updateContextPromptPost(session, 'post-123', 0, 'alice');

      expect(session.platform.updatePost).toHaveBeenCalledWith(
        'post-123',
        expect.stringContaining('Continuing without context')
      );
    });

    it('updates post with skip message (selection = "skip")', async () => {
      const session = createMockSession();

      await updateContextPromptPost(session, 'post-123', 'skip');

      expect(session.platform.updatePost).toHaveBeenCalledWith(
        'post-123',
        '✅ Continuing without context'
      );
    });

    it('updates post with message count selection', async () => {
      const session = createMockSession();

      await updateContextPromptPost(session, 'post-123', 5, 'bob');

      expect(session.platform.updatePost).toHaveBeenCalledWith(
        'post-123',
        expect.stringContaining('Including last 5 messages')
      );
    });

    it('includes username in message when provided', async () => {
      const session = createMockSession();

      await updateContextPromptPost(session, 'post-123', 5, 'charlie');

      expect(session.platform.updatePost).toHaveBeenCalledWith(
        'post-123',
        expect.stringContaining('charlie')
      );
    });

    it('handles update errors gracefully', async () => {
      const session = createMockSession({
        platformOverrides: {
          updatePost: mock(() => Promise.reject(new Error('Update failed'))),
        },
      });

      // Should not throw
      await expect(updateContextPromptPost(session, 'post-123', 'timeout')).resolves.toBeUndefined();
    });
  });

  describe('computeMissedDelta (multi-bot handoff)', () => {
    const msg = (id: string, username: string, message = `m-${id}`): ThreadMessage => ({
      id, userId: `u-${username}`, username, message, createAt: 0,
    });
    const history: ThreadMessage[] = [
      msg('1', 'alice'),
      msg('2', 'bot1'),
      msg('3', 'alice'),
      msg('4', 'bot1'),
      msg('5', 'alice'), // the triggering @mention
    ];

    it('returns messages after lastSeenPostId, excluding trigger and own posts', () => {
      // bot2 last saw post '2'; trigger is '5'; bot2's own posts filtered out.
      const delta = computeMissedDelta(history, '2', 'bot2', '5');
      expect(delta.map(m => m.id)).toEqual(['3', '4']);
    });

    it('drops THIS bot\'s own posts from the delta', () => {
      // From bot1's perspective, its own posts ('2','4') are already in context.
      const delta = computeMissedDelta(history, '1', 'bot1', '5');
      expect(delta.map(m => m.id)).toEqual(['3']);
    });

    it('treats an undefined marker as the whole window (minus trigger/own)', () => {
      const delta = computeMissedDelta(history, undefined, 'bot2', '5');
      expect(delta.map(m => m.id)).toEqual(['1', '2', '3', '4']);
    });

    it('treats a trimmed-out marker as the whole window', () => {
      const delta = computeMissedDelta(history, 'no-such-id', 'bot2', '5');
      expect(delta.map(m => m.id)).toEqual(['1', '2', '3', '4']);
    });

    it('returns empty when nothing was missed (marker is the newest post)', () => {
      const delta = computeMissedDelta(history, '4', 'bot2', '5');
      expect(delta).toEqual([]);
    });

    it('caps to the newest `cap` messages', () => {
      const big: ThreadMessage[] = Array.from({ length: DELTA_MSG_CAP + 10 }, (_, i) =>
        msg(String(i + 1), 'alice')
      );
      const delta = computeMissedDelta(big, undefined, 'bot2', 'none');
      expect(delta.length).toBe(DELTA_MSG_CAP);
      // Keeps the newest, drops the oldest.
      expect(delta[delta.length - 1].id).toBe(String(DELTA_MSG_CAP + 10));
      expect(delta[0].id).toBe(String(11));
    });

    it('drops non-content posts (working/system) but keeps human + bot content', () => {
      const h: ThreadMessage[] = [
        { id: '1', userId: 'u', username: 'alice', message: 'hi', createAt: 0 },                    // human, no kind
        { id: '2', userId: 'u', username: 'bot1', message: 'the answer', createAt: 0, kind: 'content' },
        { id: '3', userId: 'u', username: 'bot1', message: '🛠️ Working', createAt: 0, kind: 'working' },
        { id: '4', userId: 'u', username: 'bot1', message: '⚠️ error', createAt: 0, kind: 'system' },
      ];
      const delta = computeMissedDelta(h, undefined, 'bot2', 'none');
      expect(delta.map(m => m.id)).toEqual(['1', '2']);
    });
  });

  describe('formatMissedMessagesForClaude', () => {
    const msg = (username: string, message: string): ThreadMessage => ({
      id: `${username}-${message.slice(0, 4)}`, userId: `u-${username}`, username, message, createAt: 0,
    });

    it('returns empty string for no messages', () => {
      expect(formatMissedMessagesForClaude([])).toBe('');
    });

    it('attributes each line and includes a header + current-request trailer', () => {
      const out = formatMissedMessagesForClaude([msg('alice', 'hi'), msg('bot1', 'the config is X')]);
      expect(out).toContain('Messages you missed');
      expect(out).toContain('@alice: hi');
      expect(out).toContain('@bot1: the config is X'); // peer bot messages are included
      expect(out).toContain('[Current request:]');
    });

    it('truncates a very long single message to DELTA_TRUNC', () => {
      const long = 'x'.repeat(DELTA_TRUNC + 100);
      const out = formatMissedMessagesForClaude([msg('alice', long)]);
      expect(out).toContain('x'.repeat(DELTA_TRUNC) + '…');
      expect(out).not.toContain('x'.repeat(DELTA_TRUNC + 1));
    });

    it('passes a realistic multi-paragraph message through WHOLE (no default truncation)', () => {
      // A bot receiving a handoff must not silently get a cut-down history. A
      // ~2.8k-char message (the kind that used to lose ~2.3k chars under the old
      // 500-char cap) must arrive in full.
      const realistic = 'Dave: ' + 'word '.repeat(560); // ~2.8k chars
      expect(realistic.length).toBeGreaterThan(2500);
      expect(realistic.length).toBeLessThan(DELTA_TRUNC);
      const out = formatMissedMessagesForClaude([msg('dave', realistic)]);
      expect(out).toContain(realistic); // verbatim, not truncated
      expect(out).not.toContain('…');
    });

    it('appends attachment URLs when no local copy is available (fallback)', () => {
      const withFile: ThreadMessage = {
        id: 'p', userId: 'u', username: 'tarek', message: 'see this', createAt: 0,
        files: [{ id: 'f1', name: 'shot.png', url: 'https://mm.example/api/v4/files/f1' }],
      };
      const out = formatMissedMessagesForClaude([withFile]);
      expect(out).toContain('@tarek: see this');
      expect(out).toContain('attachments: shot.png → https://mm.example/api/v4/files/f1');
    });

    it('prefers a local path over the URL when the attachment was downloaded', () => {
      // Regression: opencode can Read a local path but can't authenticate to a
      // platform file URL — its webfetch failed on the mm.allaoui.de URL.
      const withFile: ThreadMessage = {
        id: 'p', userId: 'u', username: 'tarek', message: 'see this', createAt: 0,
        files: [{ id: 'f1', name: 'shot.png', url: 'https://mm.example/api/v4/files/f1' }],
      };
      const paths = new Map([['f1', '/tmp/uploads/abc/shot.png']]);
      const out = formatMissedMessagesForClaude([withFile], paths);
      expect(out).toContain('attachments: shot.png → /tmp/uploads/abc/shot.png');
      expect(out).not.toContain('https://mm.example');
    });

    it('falls back to the URL per-file when only some downloads succeeded', () => {
      const msg2: ThreadMessage = {
        id: 'p', userId: 'u', username: 'tarek', message: 'two files', createAt: 0,
        files: [
          { id: 'f1', name: 'a.png', url: 'https://mm.example/files/f1' },
          { id: 'f2', name: 'b.png', url: 'https://mm.example/files/f2' },
        ],
      };
      const out = formatMissedMessagesForClaude([msg2], new Map([['f1', '/tmp/uploads/a.png']]));
      expect(out).toContain('a.png → /tmp/uploads/a.png');
      expect(out).toContain('b.png → https://mm.example/files/f2');
    });
  });
});
