/**
 * Scenario 04 — open the thread by addressing BOTH bots at once.
 *
 * A single seed @mentions both bots simultaneously. This probes the multi-bot
 * baton/coordination: does exactly one bot take the turn, do both answer (and
 * then converge or echo-loop), and does the history each bot sees stay sane?
 */
import type { ScenarioContext } from '../lib/context.js';
import { heading, info, pass, warn } from '../lib/report.js';
import { analyzeConversation, reportTimeline } from '../lib/analyze-conversation.js';

export async function runDualOpen(ctx: ScenarioContext): Promise<void> {
  const [a, b] = ctx.bots;
  heading('Scenario 04 — open by addressing BOTH bots at once');

  const seed =
    `@${a.botName} @${b.botName} — both of you at once: each introduce yourself to the other in ONE short sentence, ` +
    `then have a brief exchange. Single short sentences only.`;

  const post = await ctx.post(seed);
  info(`Seeded thread ${post.id} addressing both bots; waiting…`);
  const thread = await ctx.waitForQuiet(post.id, { quietMs: 25000, maxWaitMs: 300000 });

  reportTimeline(thread);

  // Coordination check: who answered first, and did BOTH engage?
  heading('Coordination');
  const botPosts = thread.filter((p) => p.author === a.botName || p.author === b.botName);
  const firstResponder = botPosts[0]?.author;
  const responders = new Set(botPosts.map((p) => p.author));
  if (firstResponder) pass(`First responder: @${firstResponder}`);
  if (responders.size === 2) pass('Both bots engaged in the thread');
  else warn(`Only one bot engaged (@${[...responders][0] ?? 'none'}) — the other never took a turn.`);
  // Rough echo-loop smell: many posts for a "brief" intro is suspicious.
  if (botPosts.length > 8) warn(`${botPosts.length} bot posts for a brief intro — possible echo/loop, eyeball the timeline.`);

  analyzeConversation(ctx, thread, post.id);
}
