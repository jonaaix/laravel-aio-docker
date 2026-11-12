import { describe, test, expect } from 'bun:test';
import { parseTranscript, extractText, type Turn } from './transcripts.js';
import { analyzeTokens } from './tokens.js';
import { checkHistory } from './history.js';
import { checkThreadTimeline, checkRelativeOrder, type ThreadPost } from './ordering.js';

// A realistic transcript fragment in Claude Code's on-disk JSONL shape.
function line(obj: unknown): string {
  return JSON.stringify(obj);
}
function asstLine(text: string, usage: Record<string, number>, model = 'claude-sonnet-4-5'): string {
  return line({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }], usage, model } });
}
function userLine(text: string): string {
  return line({ type: 'user', message: { role: 'user', content: text } });
}

describe('parseTranscript', () => {
  test('keeps user/assistant turns, ignores bookkeeping, extracts usage', () => {
    const jsonl = [
      line({ type: 'queue-operation' }),
      userLine('hi'),
      line({ type: 'attachment' }),
      asstLine('hello', {
        input_tokens: 12,
        cache_creation_input_tokens: 1000,
        cache_read_input_tokens: 5000,
        output_tokens: 40,
      }),
      line({ type: 'result', usage: {} }),
    ].join('\n');
    const turns = parseTranscript(jsonl);
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant']);
    expect(turns[0].text).toBe('hi');
    expect(turns[1].usage).toEqual({ input: 12, cacheCreate: 1000, cacheRead: 5000, output: 40 });
    expect(turns[1].model).toBe('claude-sonnet-4-5');
  });

  test('extractText handles string, text blocks and tool blocks', () => {
    expect(extractText('plain')).toBe('plain');
    expect(extractText([{ type: 'text', text: 'a' }, { type: 'tool_use', name: 'Bash' }])).toBe('a«tool_use:Bash»');
  });

  test('skips malformed lines', () => {
    expect(parseTranscript('not json\n' + userLine('ok'))).toHaveLength(1);
  });
});

describe('analyzeTokens', () => {
  test('healthy caching → high hit ratio, no warnings', () => {
    const turns = parseTranscript(
      [
        userLine('m1'),
        asstLine('r1', { input_tokens: 20, cache_creation_input_tokens: 8000, cache_read_input_tokens: 0, output_tokens: 30 }),
        userLine('m2'),
        asstLine('r2', { input_tokens: 15, cache_creation_input_tokens: 50, cache_read_input_tokens: 8000, output_tokens: 25 }),
      ].join('\n'),
    );
    const r = analyzeTokens(turns);
    expect(r.assistantTurns).toBe(2);
    expect(r.cacheHitRatio).toBeGreaterThan(0.4);
    expect(r.warnings).toHaveLength(0);
  });

  test('cold cache on a follow-up → warning', () => {
    const turns = parseTranscript(
      [
        asstLine('r1', { input_tokens: 20, cache_creation_input_tokens: 8000, cache_read_input_tokens: 0, output_tokens: 30 }),
        // follow-up re-sends everything as fresh input, nothing from cache
        asstLine('r2', { input_tokens: 9000, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 25 }),
      ].join('\n'),
    );
    const r = analyzeTokens(turns);
    expect(r.warnings.join(' ')).toContain('cold prompt cache');
  });
});

describe('checkHistory', () => {
  const userTurns = ['[permalink] alice: hello there', 'bob replied: sure thing'];
  test('all present in order → ok', () => {
    const r = checkHistory(['hello there', 'sure thing'], userTurns);
    expect(r.ok).toBe(true);
  });
  test('missing message flagged', () => {
    const r = checkHistory(['hello there', 'NOT SENT'], userTurns);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['NOT SENT']);
  });
  test('duplicate delivery flagged', () => {
    const r = checkHistory(['dup'], ['x dup', 'y dup again']);
    expect(r.duplicated).toEqual(['dup']);
    expect(r.ok).toBe(false);
  });
});

describe('checkRelativeOrder (typing-race)', () => {
  test('preserved order → ok', () => {
    const r = checkRelativeOrder(['first', 'second', 'third'], ['u: first', 'u: second', 'u: third']);
    expect(r.ok).toBe(true);
  });
  test('inversion detected', () => {
    const r = checkRelativeOrder(['first', 'second'], ['u: second', 'u: first']);
    expect(r.ok).toBe(false);
    expect(r.issues.join(' ')).toContain('Out of order');
  });
  test('missing message detected', () => {
    const r = checkRelativeOrder(['a', 'b'], ['u: a']);
    expect(r.ok).toBe(false);
    expect(r.notObserved).toEqual(['b']);
  });
  test('several messages batched into ONE turn keep their in-text order', () => {
    // Rapid mid-generation arrivals get coalesced into a single turn.
    const r = checkRelativeOrder(
      ['RACE-1 x.', 'RACE-2 y.', 'RACE-3 z.'],
      ['[pl] RACE-1 x. [pl] RACE-2 y. [pl] RACE-3 z.'],
    );
    expect(r.ok).toBe(true);
    expect(r.observedOrder).toEqual(['RACE-1 x.', 'RACE-2 y.', 'RACE-3 z.']);
  });
  test('batched but reordered within the turn is flagged', () => {
    const r = checkRelativeOrder(['first', 'second'], ['second ... first']);
    expect(r.ok).toBe(false);
  });
});

describe('checkHistory — recap/context awareness', () => {
  const RECAP = 'Messages you missed while another assistant was active';
  test('a message quoted in a recap block is NOT a duplicate delivery', () => {
    const turns = ['alice: hello', `${RECAP}: alice: hello (context)`];
    const r = checkHistory(['hello'], turns);
    expect(r.duplicated).toEqual([]);
    expect(r.ok).toBe(true);
  });
  test('the same message in two DIRECT turns IS a duplicate', () => {
    const r = checkHistory(['hello'], ['x hello', 'y hello']);
    expect(r.duplicated).toEqual(['hello']);
  });
  test('a recap re-quoting an earlier message does not break ordering', () => {
    // b is re-quoted in a recap before a's direct turn — must not flag "out of order".
    const turns = [`${RECAP}: b-msg`, 'direct a-msg', 'direct b-msg'];
    const r = checkHistory(['a-msg', 'b-msg'], turns);
    expect(r.orderPreserved).toBe(true);
  });
});

describe('checkThreadTimeline', () => {
  test('monotonic → ok', () => {
    const posts: ThreadPost[] = [
      { createAt: 1, author: 'alice', message: 'a' },
      { createAt: 2, author: 'bot', message: 'b' },
    ];
    expect(checkThreadTimeline(posts).ok).toBe(true);
  });
  test('backwards timestamp → flagged', () => {
    const posts: ThreadPost[] = [
      { createAt: 5, author: 'alice', message: 'a' },
      { createAt: 3, author: 'bot', message: 'b' },
    ];
    const r = checkThreadTimeline(posts);
    expect(r.ok).toBe(false);
    expect(r.outOfOrder).toHaveLength(1);
  });
});

// Type-only guard: Turn shape stays stable.
const _t: Turn = { role: 'user', text: 'x' };
void _t;
