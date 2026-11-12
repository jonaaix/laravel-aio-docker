/**
 * Scenario 02 — controls + resume.
 *
 * Drives the interrupt/pause controls, then resumes the session with a normal
 * chat message and lets the bots continue — checking history stays continuous
 * and ordering stays correct across the interruption.
 *
 *   stop     — bare "stop" keyword: immediate interrupt of the current answer.
 *   !escape  — interrupt without killing the session.
 *   !pause   — pause the session (resumable by a later message).
 *
 * Interrupt-while-generating is timing-dependent; we send controls promptly and
 * report what actually happened rather than asserting a hard pass/fail.
 */
import type { ScenarioContext } from '../lib/context.js';
import { heading, info, pass } from '../lib/report.js';
import { sleep } from '../lib/mm.js';
import { analyzeConversation, reportTimeline } from '../lib/analyze-conversation.js';

export async function runCommandsResume(ctx: ScenarioContext): Promise<void> {
  const [a, b] = ctx.bots;
  heading('Scenario 02 — controls (stop / !escape / !pause) + resume');

  const seed =
    `@${a.botName} Chat with @${b.botName} in single short sentences about anything simple. ` +
    `Keep it going until told to stop. Start now.`;
  const post = await ctx.post(seed);
  const root = post.id;
  info(`Seeded thread ${root}`);

  await sleep(6000);
  await ctx.post('stop', root);
  info('Sent bare "stop" (immediate interrupt)');
  await sleep(4000);
  await ctx.post('!escape', root);
  info('Sent !escape');
  await sleep(4000);
  await ctx.post('!pause', root);
  info('Sent !pause');
  await sleep(4000);

  await ctx.post(`@${a.botName} resume — one more short sentence to @${b.botName}, then let it bounce twice.`, root);
  info('Sent resume message; waiting for the bots to finish…');
  const thread = await ctx.waitForQuiet(root, { quietMs: 25000, maxWaitMs: 300000 });

  pass('Controls sent; analyzing continuity after resume');
  reportTimeline(thread);
  analyzeConversation(ctx, thread, root);
}
