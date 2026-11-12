/**
 * realtest — chat-history correctness.
 *
 * In a two-bot conversation each bot's session must receive the peer's messages
 * as user turns, in order, exactly once. We check the transcript's user turns
 * against the sequence of messages we expect the bot to have seen:
 *
 *  - missing:    an expected message never appears → bot answered blind.
 *  - duplicated: an expected message appears in >1 user turn → re-delivered
 *                (confuses the model AND wastes tokens).
 *  - order:      expected messages appear out of their real chronological order.
 *
 * Matching is by substring (the bot prefixes metadata like a permalink line, so
 * we look for the expected sentence *inside* a user turn rather than ==).
 */
export interface HistoryResult {
  ok: boolean;
  userTurnCount: number;
  missing: string[];
  duplicated: string[];
  orderPreserved: boolean;
  issues: string[];
}

/** Index of the first user turn (at/after `from`) containing `needle`, or -1. */
function findFrom(userTexts: string[], needle: string, from: number): number {
  for (let i = from; i < userTexts.length; i++) {
    if (userTexts[i].includes(needle)) return i;
  }
  return -1;
}

/** Count how many user turns contain `needle`. */
function countContaining(userTexts: string[], needle: string): number {
  return userTexts.reduce((n, t) => (t.includes(needle) ? n + 1 : n), 0);
}

/**
 * The bot re-includes messages that arrived while it was busy in a
 * "missed messages" context block. Such a message legitimately appears both as
 * a direct turn AND quoted in a later recap — that's context provision, not a
 * wasteful re-delivery, so recap turns are excluded from duplicate counting.
 */
const RECAP_MARKER = 'Messages you missed while another assistant was active';
const isRecap = (t: string): boolean => t.includes(RECAP_MARKER);

/**
 * @param expected the messages the bot should have received, in chronological order.
 * @param userTexts the text of every user-role turn in the bot's transcript.
 */
export function checkHistory(expected: string[], userTexts: string[]): HistoryResult {
  const missing: string[] = [];
  const duplicated: string[] = [];
  const issues: string[] = [];
  let cursor = 0;
  let orderPreserved = true;

  // Direct-delivery turns only. Recap/context blocks re-quote earlier messages,
  // so they must be excluded from BOTH duplicate detection and ordering (order
  // is defined by the sequence of direct deliveries, not by context recaps).
  const directTexts = userTexts.filter((t) => !isRecap(t));

  for (const msg of expected) {
    if (countContaining(userTexts, msg) === 0) {
      missing.push(msg); // presence: any turn (direct or recap) counts
      continue;
    }
    if (countContaining(directTexts, msg) > 1) duplicated.push(msg);
    // Order check over direct turns only. A message delivered ONLY via a recap
    // (never a direct turn) doesn't participate in ordering.
    const at = findFrom(directTexts, msg, cursor);
    if (at !== -1) {
      cursor = at + 1;
    } else if (directTexts.some((t) => t.includes(msg))) {
      // Exists as a direct delivery, but before the cursor → genuinely out of order.
      orderPreserved = false;
    }
  }

  if (missing.length) issues.push(`Missing from history: ${missing.map((m) => JSON.stringify(m)).join(', ')}`);
  if (duplicated.length)
    issues.push(`Delivered more than once: ${duplicated.map((m) => JSON.stringify(m)).join(', ')}`);
  if (!orderPreserved) issues.push('Messages appear out of chronological order in the transcript.');

  return {
    ok: missing.length === 0 && duplicated.length === 0 && orderPreserved,
    userTurnCount: userTexts.length,
    missing,
    duplicated,
    orderPreserved,
    issues,
  };
}
