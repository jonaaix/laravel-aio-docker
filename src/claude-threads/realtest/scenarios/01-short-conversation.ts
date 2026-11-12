/**
 * Scenario 01 — short-sentence conversation.
 *
 * Seed a two-bot conversation where every message is a single short sentence,
 * let it bounce a few times, then verify each bot received the correct chat
 * history and check whether tokens were burned unnecessarily.
 */
import type { ScenarioContext } from '../lib/context.js';
import { heading, info } from '../lib/report.js';
import { analyzeConversation, reportTimeline } from '../lib/analyze-conversation.js';

export async function runShortConversation(ctx: ScenarioContext): Promise<void> {
  const [a, b] = ctx.bots;
  heading('Scenario 01 — short-sentence conversation');

  const seed =
    `@${a.botName} Have a brief back-and-forth with @${b.botName}. ` +
    `Hard rule: EVERY message must be a single SHORT sentence (no lists, no tools). ` +
    `Greet @${b.botName}, ask one simple question, and let it bounce ~3 times. Start now.`;

  const post = await ctx.post(seed);
  info(`Seeded thread ${post.id}; waiting for the bots to finish (real LLM turns take a while)…`);
  // Quiet window must exceed a single real turn's latency so we don't declare
  // the conversation "done" while a bot is still generating.
  const thread = await ctx.waitForQuiet(post.id, { quietMs: 25000, maxWaitMs: 300000 });

  reportTimeline(thread);
  analyzeConversation(ctx, thread, post.id);
}
