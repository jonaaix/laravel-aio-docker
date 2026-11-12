/**
 * Scenario 05 — alternately message BOTH bots while they're still answering.
 *
 * Harder than 03 (which hammered one bot): we open a task that keeps both bots
 * busy, then fire follow-ups ALTERNATELY at bot A and bot B mid-generation.
 * We then verify, per bot, that ITS messages arrived in send-order and that the
 * two streams did not cross-contaminate (bot A must not receive bot B's
 * follow-ups as its own turns, and vice versa).
 */
import type { ScenarioContext } from '../lib/context.js';
import { heading, info, pass, fail } from '../lib/report.js';
import { sleep } from '../lib/mm.js';
import { findClaudeSession } from '../lib/sessions.js';
import { readTranscript } from '../lib/transcripts.js';
import { checkRelativeOrder } from '../lib/ordering.js';
import { reportTimeline } from '../lib/analyze-conversation.js';

export async function runAlternatingLoad(ctx: ScenarioContext): Promise<void> {
  const [a, b] = ctx.bots;
  heading('Scenario 05 — alternating messages to both bots under load');

  // Open with something that keeps both busy for a moment.
  const seed =
    `@${a.botName} and @${b.botName}: each of you, in one short sentence, name a favorite tool. Take your time.`;
  const post = await ctx.post(seed);
  const root = post.id;
  info(`Seeded thread ${root}; firing alternating follow-ups mid-generation…`);

  // Distinctly labelled per bot so we can check each stream independently.
  const forA = ['A-ALT-1 to bot A.', 'A-ALT-2 to bot A.'];
  const forB = ['B-ALT-1 to bot B.', 'B-ALT-2 to bot B.'];
  // Interleave: A1, B1, A2, B2 — small gaps, while the models generate.
  const interleaved: Array<{ bot: string; msg: string }> = [
    { bot: a.botName, msg: forA[0] },
    { bot: b.botName, msg: forB[0] },
    { bot: a.botName, msg: forA[1] },
    { bot: b.botName, msg: forB[1] },
  ];
  await sleep(700);
  for (const { bot, msg } of interleaved) {
    await ctx.post(`@${bot} ${msg}`, root);
    await sleep(300);
  }

  const thread = await ctx.waitForQuiet(root, { quietMs: 25000, maxWaitMs: 300000 });
  reportTimeline(thread);

  // Per-bot: correct order + no cross-contamination.
  for (const { bot, mine, theirs } of [
    { bot: a, mine: forA, theirs: forB },
    { bot: b, mine: forB, theirs: forA },
  ]) {
    heading(`Into @${bot.botName}'s session`);
    const sid = findClaudeSession(bot.platformId, root, ctx.sessionsPath);
    if (!sid) {
      fail('No session found for this bot — cannot verify.');
      continue;
    }
    const userTurns = readTranscript(ctx.workingDir, sid)
      .filter((t) => t.role === 'user')
      .map((t) => t.text);

    const order = checkRelativeOrder(mine, userTurns);
    if (order.ok) pass(`Own messages arrived in send-order: ${order.observedOrder.join(' → ')}`);
    else {
      fail('Ordering problem for own messages:');
      for (const issue of order.issues) info(`  - ${issue}`);
    }

    // Cross-contamination: the OTHER bot's follow-ups should not appear as this
    // bot's DIRECT turns (a recap/context mention is acceptable).
    const RECAP = 'Messages you missed while another assistant was active';
    const directTurns = userTurns.filter((t) => !t.includes(RECAP));
    const leaked = theirs.filter((m) => directTurns.some((t) => t.includes(m)));
    if (leaked.length === 0) pass('No cross-contamination from the other bot as direct turns');
    else fail(`Cross-contamination — received the other bot's messages directly: ${leaked.join(', ')}`);
  }
}
