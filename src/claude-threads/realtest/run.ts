/**
 * realtest runner — spins up an ISOLATED claude-threads bot instance against an
 * in-process fake Mattermost and drives real-LLM scenarios. Fully self-contained:
 * no real server, no token, and it never touches your running `bun dev`.
 *
 *   bun realtest/run.ts [connect|01|02|03|all]
 *   REALTEST_MODEL=haiku bun realtest/run.ts 01     # cheaper run
 *
 *   connect   just start the harness + confirm both bots connect (no LLM cost)
 *   01 short  short-sentence conversation → history + token check
 *   02 cmds   stop / !escape / !pause, then resume → continuity + ordering
 *   03 race   rapid messages while the model generates → ordering under load
 *
 * Manual + cost-incurring (spends real LLM tokens on `REALTEST_MODEL`, default
 * sonnet). Not part of `bun test`; never runs in CI.
 */
import { rmSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { startBotHarness, type BotHarnessOptions } from './lib/bot-harness.js';
import { contextFromHarness } from './lib/context.js';
import { heading, info, warn, pass, fail } from './lib/report.js';
import { runShortConversation } from './scenarios/01-short-conversation.js';
import { runCommandsResume } from './scenarios/02-commands-resume.js';
import { runTypingRace } from './scenarios/03-typing-race.js';

const which = (process.argv[2] || 'all').toLowerCase();
const model = process.env.REALTEST_MODEL || 'sonnet';

// `dump-prompts` mode: capture the exact system prompts + per-turn context the
// bots receive. Enable the opt-in capture in the child (env is inherited by the
// spawned bot) BEFORE the harness starts, and run the two bots with mixed
// writeScopes so the full matrix shows — bot A unrestricted (chief), bot B
// confined (write-scope rule + hand-off to A).
const isDump = which === 'dump-prompts' || which === 'prompts';
const harnessOpts: BotHarnessOptions = { model };
if (isDump) {
  // Fixed, easy-to-find location (gitignored), wiped fresh each run so you
  // always know where to look: <repo>/realtest/.prompts/
  const dumpDir = join(import.meta.dir, '.prompts');
  rmSync(dumpDir, { recursive: true, force: true });
  mkdirSync(dumpDir, { recursive: true });
  process.env.CLAUDE_THREADS_PROMPT_DUMP = dumpDir;
  harnessOpts.writeScopes = ['unrestricted', 'workingDir'];
  info(`prompt capture → ${dumpDir}`);
}

heading('realtest — isolated fake-Mattermost harness');
info(`Starting an isolated bot instance (model=${model}) against an in-process fake Mattermost…`);

let harness;
try {
  harness = await startBotHarness(harnessOpts);
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
pass(`Two bots connected: @${harness.bots.map((b) => b.username).join(', @')}`);
info(`working dir: ${harness.workingDir}`);
info(`bot log: ${harness.logPath}`);

if (which === 'connect') {
  pass('Connect check OK — harness works end-to-end at the transport level (no LLM spent).');
  await harness.stop();
  process.exit(0);
}

const ctx = contextFromHarness(harness);
let failed = false;
try {
  if (isDump) {
    await runDumpPrompts(ctx);
  } else if (which === '01' || which === 'short' || which === '02' || which === 'commands' || which === '03' || which === 'race' || which === 'all') {
    if (which === '01' || which === 'short' || which === 'all') await runShortConversation(ctx);
    if (which === '02' || which === 'commands' || which === 'all') await runCommandsResume(ctx);
    if (which === '03' || which === 'race' || which === 'all') await runTypingRace(ctx);
  } else {
    heading('Usage');
    info('bun realtest/run.ts [connect|01|02|03|all|dump-prompts]');
  }
} catch (err) {
  failed = true;
  warn(`Scenario aborted: ${err instanceof Error ? err.stack || err.message : String(err)}`);
} finally {
  await harness.stop();
}

heading('Done');
info('Review the timeline + per-bot history/token report above.');
process.exit(failed ? 1 : 0);

/**
 * Drive a minimal two-bot exchange that forces a hand-off (so the confined bot
 * B consults chief bot A), then print every captured prompt. The capture files
 * were written by the child bot to CLAUDE_THREADS_PROMPT_DUMP.
 */
async function runDumpPrompts(c: ReturnType<typeof contextFromHarness>): Promise<void> {
  const [a, b] = c.bots;
  heading('dump-prompts — capturing the real system prompts + per-turn context');
  // Deterministic capture (don't rely on a model-driven hand-off, which small
  // models botch). Address each bot directly so BOTH spawn — bot A gets the
  // chief/write-authority system prompt, bot B the confined write-scope prompt.
  // Then send bot B a SECOND message: that follow-up turn goes through
  // prependMissedDelta, so the per-turn expert-peer roster is captured too.
  const quiet = { quietMs: 18000, maxWaitMs: 150000 };

  info('Turn 1 — addressing chief bot A (captures its write-authority prompt)…');
  const pA = await c.post(`@${a.botName} Reply with exactly one short sentence: say hello.`);
  await c.waitForQuiet(pA.id, quiet);

  info('Turn 2 — addressing confined bot B (captures its write-scope prompt)…');
  const pB = await c.post(`@${b.botName} Reply with exactly one short sentence: say hello.`);
  await c.waitForQuiet(pB.id, quiet);

  info('Turn 3 — follow-up to bot B (captures the injected expert-peer roster)…');
  const pB2 = await c.post(`@${b.botName} One more short sentence: what is 2+2?`, pB.id);
  await c.waitForQuiet(pB.id, quiet);
  void pB2;

  const dir = process.env.CLAUDE_THREADS_PROMPT_DUMP!;
  heading('Captured prompts');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  if (files.length === 0) {
    warn(`No prompt files in ${dir} — did any session spawn?`);
    return;
  }
  for (const f of files) {
    heading(`── ${f} ──`);
    process.stdout.write(readFileSync(join(dir, f), 'utf8') + '\n');
  }
  info(`Raw files: ${dir}`);
}
