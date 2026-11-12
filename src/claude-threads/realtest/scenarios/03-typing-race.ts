/**
 * Scenario 03 — typing-race hardness test.
 *
 * Fire several short messages in quick succession WHILE the bot is still
 * generating its previous response, then verify the bot's session received them
 * in send-order (not shuffled, merged, or dropped). This is where ordering bugs
 * hide: a follow-up landing before the in-flight answer finishes.
 */
import type { ScenarioContext } from '../lib/context.js';
import { heading, info, pass, fail } from '../lib/report.js';
import { sleep } from '../lib/mm.js';
import { findClaudeSession } from '../lib/sessions.js';
import { readTranscript } from '../lib/transcripts.js';
import { checkRelativeOrder } from '../lib/ordering.js';
import { reportTimeline } from '../lib/analyze-conversation.js';

export async function runTypingRace(ctx: ScenarioContext): Promise<void> {
  const a = ctx.bots[0];
  heading('Scenario 03 — typing-race (messages while the model is generating)');

  const seed = `@${a.botName} In one short sentence, describe the ocean. Take your time.`;
  const post = await ctx.post(seed);
  const root = post.id;
  info(`Seeded thread ${root}; firing rapid follow-ups while it generates…`);

  const rapid = ['RACE-1 first follow-up.', 'RACE-2 second follow-up.', 'RACE-3 third follow-up.', 'RACE-4 fourth follow-up.'];
  await sleep(700); // small head start so the model is mid-generation
  for (const msg of rapid) {
    await ctx.post(`@${a.botName} ${msg}`, root);
    await sleep(250);
  }

  const thread = await ctx.waitForQuiet(root, { quietMs: 25000, maxWaitMs: 300000 });
  reportTimeline(thread);

  heading(`Ordering into @${a.botName}'s session`);
  const claudeSessionId = findClaudeSession(a.platformId, root, ctx.sessionsPath);
  if (!claudeSessionId) {
    fail('No session found for the target bot — cannot verify ordering.');
    return;
  }
  const userTurns = readTranscript(ctx.workingDir, claudeSessionId)
    .filter((t) => t.role === 'user')
    .map((t) => t.text);
  const order = checkRelativeOrder(rapid, userTurns);
  if (order.ok) pass(`All ${rapid.length} rapid messages arrived in send-order: ${order.observedOrder.join(' → ')}`);
  else {
    fail('Ordering anomaly under load:');
    for (const issue of order.issues) info(`  - ${issue}`);
  }
}
