/**
 * realtest — ordering / interleaving check.
 *
 * Two independent checks:
 *
 *  - checkThreadTimeline: the raw Mattermost thread should be chronologically
 *    monotonic (create_at non-decreasing). A regression here means posts are
 *    being written out of order.
 *
 *  - checkRelativeOrder: given what we SENT (expected) and what the bot's
 *    session actually saw (observed user turns), verify the observed sequence
 *    preserves the relative order of the expected messages. This is the core
 *    check for the typing-race test: messages fired while the model is still
 *    generating must still land in the session in send-order, not shuffled or
 *    merged out of sequence.
 */
export interface ThreadPost {
  createAt: number;
  author: string;
  message: string;
}

export interface TimelineResult {
  ok: boolean;
  outOfOrder: Array<{ index: number; author: string; createAt: number; prevCreateAt: number }>;
}

export function checkThreadTimeline(posts: ThreadPost[]): TimelineResult {
  const outOfOrder: TimelineResult['outOfOrder'] = [];
  for (let i = 1; i < posts.length; i++) {
    if (posts[i].createAt < posts[i - 1].createAt) {
      outOfOrder.push({
        index: i,
        author: posts[i].author,
        createAt: posts[i].createAt,
        prevCreateAt: posts[i - 1].createAt,
      });
    }
  }
  return { ok: outOfOrder.length === 0, outOfOrder };
}

export interface RelativeOrderResult {
  ok: boolean;
  /** Expected messages, in the order they were actually observed. */
  observedOrder: string[];
  /** Expected messages never observed. */
  notObserved: string[];
  issues: string[];
}

/**
 * Map each observed text to the expected message it contains, then verify those
 * expected messages appear in their original relative order (no inversions).
 *
 * @param expected messages in the order we sent them.
 * @param observed texts the session saw, in the order it saw them.
 */
export function checkRelativeOrder(expected: string[], observed: string[]): RelativeOrderResult {
  // Scan each observed turn for ALL expected messages it contains, ordered by
  // their position within the turn. This handles the common case where several
  // rapid messages are batched into a SINGLE turn — they still have a
  // well-defined order (their position in the text).
  const seenAll: Array<{ msg: string; expIdx: number }> = [];
  for (const text of observed) {
    const inTurn = expected
      .map((m, expIdx) => ({ msg: m, expIdx, pos: text.indexOf(m) }))
      .filter((x) => x.pos >= 0)
      .sort((a, b) => a.pos - b.pos);
    for (const x of inTurn) seenAll.push({ msg: x.msg, expIdx: x.expIdx });
  }
  // First observation of each expected message, in observation order.
  const firstSeen = new Set<string>();
  const seenAt: Array<{ msg: string; expIdx: number }> = [];
  for (const s of seenAll) {
    if (firstSeen.has(s.msg)) continue;
    firstSeen.add(s.msg);
    seenAt.push(s);
  }

  const notObserved = expected.filter((m) => !firstSeen.has(m));

  // Order is preserved iff expIdx is non-decreasing along observation order.
  const issues: string[] = [];
  let ok = true;
  for (let i = 1; i < seenAt.length; i++) {
    if (seenAt[i].expIdx < seenAt[i - 1].expIdx) {
      ok = false;
      issues.push(
        `Out of order: ${JSON.stringify(seenAt[i].msg)} was seen after ${JSON.stringify(
          seenAt[i - 1].msg,
        )} but was sent earlier.`,
      );
    }
  }
  if (notObserved.length) issues.push(`Never observed: ${notObserved.map((m) => JSON.stringify(m)).join(', ')}`);

  return { ok: ok && notObserved.length === 0, observedOrder: seenAt.map((s) => s.msg), notObserved, issues };
}
