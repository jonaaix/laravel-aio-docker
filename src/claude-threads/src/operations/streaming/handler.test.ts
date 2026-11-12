/**
 * Tests for streaming.ts - typing indicators
 *
 * NOTE: Content flushing tests have been moved to src/operations/executors/content.test.ts
 * since that logic is now handled by ContentExecutor via MessageManager.
 * NOTE: Content-breaker tests are in src/operations/content-breaker.test.ts
 * NOTE: Task list bumping is handled by TaskListExecutor with serialization
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { startTyping, stopTyping, resolveThreadAttachments } from './handler.js';
import type { Session } from '../../session/types.js';
import { createSessionTimers, createSessionLifecycle } from '../../session/types.js';
import type { PlatformClient, ThreadFile } from '../../platform/index.js';
import { createMockFormatter } from '../../test-utils/mock-formatter.js';

// Mock platform client (minimal version for streaming tests)
function createMockPlatform() {
  return {
    sendTyping: mock(() => {}),
    getFormatter: mock(() => createMockFormatter()),
  } as unknown as PlatformClient;
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
    claude: null as any,
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

// ---------------------------------------------------------------------------
// Typing indicator tests
// ---------------------------------------------------------------------------

describe('startTyping', () => {
  let platform: PlatformClient;
  let session: Session;

  beforeEach(() => {
    platform = createMockPlatform();
    session = createTestSession(platform);
  });

  test('starts typing indicator and sets interval', () => {
    startTyping(session);

    expect(platform.sendTyping).toHaveBeenCalledWith('thread1');
    expect(session.timers.typingTimer).not.toBeNull();
  });

  test('does not restart if already typing', () => {
    startTyping(session);
    const firstTimer = session.timers.typingTimer;

    startTyping(session);

    // Timer should be the same (not restarted)
    expect(session.timers.typingTimer).toBe(firstTimer);
    // sendTyping called only once (initial call)
    expect(platform.sendTyping).toHaveBeenCalledTimes(1);
  });
});

describe('stopTyping', () => {
  let platform: PlatformClient;
  let session: Session;

  beforeEach(() => {
    platform = createMockPlatform();
    session = createTestSession(platform);
  });

  test('clears typing timer', () => {
    startTyping(session);
    expect(session.timers.typingTimer).not.toBeNull();

    stopTyping(session);

    expect(session.timers.typingTimer).toBeNull();
  });

  test('does nothing if not typing', () => {
    // Should not throw
    stopTyping(session);
    expect(session.timers.typingTimer).toBeNull();
  });
});


// ---------------------------------------------------------------------------
// resolveThreadAttachments — download thread/delta attachments to local paths
// ---------------------------------------------------------------------------

describe('resolveThreadAttachments', () => {
  const file = (id: string, name: string): ThreadFile => ({ id, name, url: `https://mm.example/files/${id}` });

  test('downloads each attachment and maps fileId → local path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rta-'));
    const platform = {
      downloadFile: mock(async (id: string) => Buffer.from(`bytes-of-${id}`)),
    } as unknown as PlatformClient;

    const map = await resolveThreadAttachments(platform, dir, [file('f1', 'shot.png'), file('f2', 'diagram.png')]);

    expect(map.size).toBe(2);
    expect(readFileSync(map.get('f1')!, 'utf8')).toBe('bytes-of-f1');
    expect(readFileSync(map.get('f2')!, 'utf8')).toBe('bytes-of-f2');
  });

  test('omits files that fail to download (caller falls back to URL)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rta-'));
    const platform = {
      downloadFile: mock(async (id: string) => {
        if (id === 'bad') throw new Error('404');
        return Buffer.from('ok');
      }),
    } as unknown as PlatformClient;

    const map = await resolveThreadAttachments(platform, dir, [file('bad', 'x.png'), file('good', 'y.png')]);

    expect(map.has('bad')).toBe(false);
    expect(map.has('good')).toBe(true);
  });

  test('returns empty when the platform cannot download files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rta-'));
    const platform = {} as unknown as PlatformClient; // no downloadFile
    const map = await resolveThreadAttachments(platform, dir, [file('f1', 'a.png')]);
    expect(map.size).toBe(0);
  });

  test('deduplicates a fileId referenced more than once (single download)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rta-'));
    const downloadFile = mock(async () => Buffer.from('x'));
    const platform = { downloadFile } as unknown as PlatformClient;

    await resolveThreadAttachments(platform, dir, [file('f1', 'a.png'), file('f1', 'a.png')]);

    expect(downloadFile).toHaveBeenCalledTimes(1);
  });
});
