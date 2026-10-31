import { describe, it, expect, mock } from 'bun:test';
import { getSessionStatus, createSessionLifecycle, clearBootAck } from './types.js';
import type { Session, SessionLifecycle } from './types.js';

describe('clearBootAck', () => {
  function sessionWithAck(bootAckPostId: string | null): { session: Session; removeReaction: ReturnType<typeof mock> } {
    const removeReaction = mock(async (_postId: string, _emoji: string) => {});
    const session = {
      bootAckPostId,
      platform: { removeReaction },
    } as unknown as Session;
    return { session, removeReaction };
  }

  it('removes the ⏳ reaction and clears the id', () => {
    const { session, removeReaction } = sessionWithAck('post_1');

    clearBootAck(session);

    expect(session.bootAckPostId).toBeNull();
    expect(removeReaction).toHaveBeenCalledWith('post_1', 'hourglass_flowing_sand');
  });

  it('is idempotent — a second call does not remove again', () => {
    const { session, removeReaction } = sessionWithAck('post_1');

    clearBootAck(session);
    clearBootAck(session);

    expect(removeReaction).toHaveBeenCalledTimes(1);
  });

  it('no-ops when no boot ack was set', () => {
    const { session, removeReaction } = sessionWithAck(null);

    clearBootAck(session);

    expect(removeReaction).not.toHaveBeenCalled();
  });

  it('swallows platform errors (reaction already gone)', () => {
    const removeReaction = mock(async () => { throw new Error('not found'); });
    const session = { bootAckPostId: 'post_1', platform: { removeReaction } } as unknown as Session;

    expect(() => clearBootAck(session)).not.toThrow();
    expect(session.bootAckPostId).toBeNull();
  });
});

describe('getSessionStatus', () => {
  // Helper to create a minimal session for testing
  function createTestSession(overrides: { isProcessing: boolean; hasClaudeResponded: boolean }): Pick<Session, 'isProcessing' | 'lifecycle'> {
    const lifecycle: SessionLifecycle = {
      ...createSessionLifecycle(),
      hasClaudeResponded: overrides.hasClaudeResponded,
    };
    return {
      isProcessing: overrides.isProcessing,
      lifecycle,
    };
  }

  it('returns "starting" when processing but Claude has not responded', () => {
    const session = createTestSession({
      isProcessing: true,
      hasClaudeResponded: false,
    });

    expect(getSessionStatus(session as Session)).toBe('starting');
  });

  it('returns "active" when processing and Claude has responded', () => {
    const session = createTestSession({
      isProcessing: true,
      hasClaudeResponded: true,
    });

    expect(getSessionStatus(session as Session)).toBe('active');
  });

  it('returns "idle" when not processing', () => {
    const session = createTestSession({
      isProcessing: false,
      hasClaudeResponded: true,
    });

    expect(getSessionStatus(session as Session)).toBe('idle');
  });

  it('returns "idle" when not processing even if Claude never responded', () => {
    const session = createTestSession({
      isProcessing: false,
      hasClaudeResponded: false,
    });

    expect(getSessionStatus(session as Session)).toBe('idle');
  });
});
