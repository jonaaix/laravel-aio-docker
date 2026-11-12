/**
 * realtest — token-burn analysis.
 *
 * "Are we burning tokens unnecessarily?" is answered from the real per-turn
 * usage in the transcript. The two things that waste money on a long chat:
 *
 *  1. Cold cache on follow-ups — if a follow-up turn reads little/nothing from
 *     the prompt cache, the whole prior context was re-sent as fresh input
 *     (billed 1×) instead of cache_read (billed ~0.1×). Healthy caching → high
 *     cache-read share on turns after the first.
 *  2. Runaway fresh input — fresh (uncached) input growing turn over turn means
 *     history/system is being re-sent instead of cached.
 *
 * All heuristics are reported as explicit, explainable warnings — never a bare
 * pass/fail — so a human can judge.
 */
import type { Turn, TokenUsage } from './transcripts.js';
import { totalInput } from './transcripts.js';

export interface TurnTokens {
  index: number;
  model?: string;
  fresh: number; // input + cacheCreate (billed at full-ish rate)
  cacheRead: number; // reused context (cheap)
  output: number;
  total: number;
  cacheReadShare: number; // cacheRead / total
}

export interface TokenReport {
  assistantTurns: number;
  totals: TokenUsage & { total: number };
  /** cache_read / total_input across all assistant turns (0..1). Higher = better. */
  cacheHitRatio: number;
  perTurn: TurnTokens[];
  warnings: string[];
}

/** Threshold below which a follow-up turn's cache-read share looks "cold". */
const COLD_CACHE_SHARE = 0.5;

export function analyzeTokens(turns: Turn[]): TokenReport {
  const assistant = turns.filter((t): t is Turn & { usage: TokenUsage } => t.role === 'assistant' && !!t.usage);

  const totals: TokenUsage & { total: number } = {
    input: 0,
    cacheCreate: 0,
    cacheRead: 0,
    output: 0,
    total: 0,
  };
  const perTurn: TurnTokens[] = [];

  assistant.forEach((t, i) => {
    const u = t.usage;
    const total = totalInput(u);
    totals.input += u.input;
    totals.cacheCreate += u.cacheCreate;
    totals.cacheRead += u.cacheRead;
    totals.output += u.output;
    totals.total += total;
    perTurn.push({
      index: i,
      model: t.model,
      fresh: u.input + u.cacheCreate,
      cacheRead: u.cacheRead,
      output: u.output,
      total,
      cacheReadShare: total > 0 ? u.cacheRead / total : 0,
    });
  });

  const cacheHitRatio = totals.total > 0 ? totals.cacheRead / totals.total : 0;
  const warnings: string[] = [];

  // Cold-cache follow-ups: after the first turn, low cache-read share means the
  // context was re-sent as fresh input instead of reused from cache.
  const cold = perTurn.slice(1).filter((t) => t.total > 2000 && t.cacheReadShare < COLD_CACHE_SHARE);
  if (cold.length) {
    warnings.push(
      `${cold.length} follow-up turn(s) had a cold prompt cache (cache-read share < ${Math.round(
        COLD_CACHE_SHARE * 100,
      )}%) — prior context was likely re-sent as fresh input. Turns: ${cold.map((t) => t.index).join(', ')}.`,
    );
  }

  // Runaway fresh input: fresh input trending up over the conversation.
  if (perTurn.length >= 3) {
    const first = perTurn[0].fresh || 1;
    const last = perTurn[perTurn.length - 1].fresh;
    if (last > first * 2 && perTurn[perTurn.length - 1].cacheReadShare < COLD_CACHE_SHARE) {
      warnings.push(
        `Fresh input grew from ${first} to ${last} tokens across the conversation with low cache reuse — history may be re-sent uncached each turn.`,
      );
    }
  }

  return { assistantTurns: assistant.length, totals, cacheHitRatio, perTurn, warnings };
}
