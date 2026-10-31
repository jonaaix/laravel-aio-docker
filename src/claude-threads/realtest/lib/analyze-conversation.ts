/**
 * realtest — after a conversation has happened in a thread, correlate each
 * bot's transcript and report: did it receive the correct chat history, and how
 * were tokens spent? Shared by all scenarios.
 */
import type { ScenarioBot } from './context.js';
import type { ThreadPost } from './mm.js';
import { findClaudeSession } from './sessions.js';
import { readTranscript, type Turn } from './transcripts.js';
import { analyzeTokens } from './tokens.js';
import { checkHistory } from './history.js';
import { checkThreadTimeline } from './ordering.js';
import { heading, pass, fail, warn, info, kv } from './report.js';

export interface BotAnalysis {
  botName: string;
  platformId: string;
  claudeSessionId?: string;
  historyOk: boolean;
  tokenWarnings: string[];
  cacheHitRatio: number;
}

/** Print the raw thread as a timeline (great for eyeballing ordering). */
export function reportTimeline(thread: ThreadPost[]): void {
  heading('Thread timeline');
  for (const p of thread) {
    const t = new Date(p.createAt).toISOString().slice(11, 19);
    info(`${t}  @${p.author.padEnd(14)} ${p.message.replace(/\n/g, ' ').slice(0, 90)}`);
  }
  const timeline = checkThreadTimeline(thread);
  if (timeline.ok) pass('Thread is chronologically monotonic');
  else fail(`Thread posts out of order at indices: ${timeline.outOfOrder.map((o) => o.index).join(', ')}`);
}

/**
 * For each bot, the messages it *should* have seen = every thread post NOT
 * authored by that bot, in chronological order (the human seed + the peer bot).
 */
export interface AnalyzeTarget {
  bots: ScenarioBot[];
  workingDir: string;
  sessionsPath: string;
}

export function analyzeConversation(ctx: AnalyzeTarget, thread: ThreadPost[], rootId: string): BotAnalysis[] {
  const results: BotAnalysis[] = [];

  for (const bot of ctx.bots) {
    heading(`Bot @${bot.botName} (${bot.platformId})`);
    const claudeSessionId = findClaudeSession(bot.platformId, rootId, ctx.sessionsPath);
    if (!claudeSessionId) {
      warn(`No persisted session for this thread — bot may not have joined the conversation. Skipping.`);
      results.push({ botName: bot.botName, platformId: bot.platformId, historyOk: false, tokenWarnings: [], cacheHitRatio: 0 });
      continue;
    }
    const turns: Turn[] = readTranscript(ctx.workingDir, claudeSessionId);
    if (turns.length === 0) {
      warn(`Transcript ${claudeSessionId} empty/not found under ${ctx.workingDir}.`);
    }

    // Expected history: everything the OTHER participants said, in order.
    // Normalize both sides the same way (drop @mentions, collapse whitespace)
    // so substring matching isn't defeated by mention formatting differences
    // (the bot strips its own leading @mention from the prompt it sees).
    const expected = thread
      .filter((p) => p.author !== bot.botName)
      .map((p) => normalizeForMatch(p.message))
      .filter(Boolean);
    const userTurns = turns.filter((t) => t.role === 'user').map((t) => normalizeForMatch(t.text));

    const hist = checkHistory(expected, userTurns);
    if (hist.ok) pass(`Chat history correct: ${hist.userTurnCount} user turn(s), all expected messages in order`);
    else {
      fail('Chat history problem:');
      for (const issue of hist.issues) info(`  - ${issue}`);
    }

    const tok = analyzeTokens(turns);
    kv('assistant turns', String(tok.assistantTurns));
    kv('cache hit ratio', `${(tok.cacheHitRatio * 100).toFixed(0)}%  (higher = less token waste)`);
    kv('input tokens', `fresh ${tok.totals.input + tok.totals.cacheCreate}  ·  cached ${tok.totals.cacheRead}`);
    kv('output tokens', String(tok.totals.output));
    if (tok.warnings.length) {
      for (const w of tok.warnings) warn(w);
    } else {
      pass('No token-waste warnings');
    }

    results.push({
      botName: bot.botName,
      platformId: bot.platformId,
      claudeSessionId,
      historyOk: hist.ok,
      tokenWarnings: tok.warnings,
      cacheHitRatio: tok.cacheHitRatio,
    });
  }
  return results;
}

/** Drop @mentions + collapse whitespace so history matching is format-agnostic. */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/@[\w.-]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
