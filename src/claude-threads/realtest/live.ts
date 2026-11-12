/**
 * realtest LIVE — drive your ALREADY-RUNNING bots against an in-process fake
 * Mattermost, by repointing their Server URL to this fake.
 *
 * Why this (not an isolated child): `claude`'s OAuth token lives in the macOS
 * Keychain and isn't usable under a different HOME, so a freshly-spawned bot
 * can't authenticate. Your running `bun dev` bots are already logged in — so we
 * reuse them and only swap the transport. Real bots, real LLMs, full control,
 * no token needed.
 *
 *   bun realtest/live.ts [01|02|03|04|05|23|all]      (default: 01)
 *   REALTEST_FAKE_PORT=8199 bun realtest/live.ts
 *
 *   01 short · 02 commands · 03 race · 04 dual-open · 05 alternating-load
 *   23 = 02+03
 */
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import yaml from 'js-yaml';
import { FakeMattermost } from './lib/fake-mattermost.js';
import { contextFromFake, type ScenarioBot } from './lib/context.js';
import { heading, info, pass, warn } from './lib/report.js';
import { sleep } from './lib/mm.js';
import { runShortConversation } from './scenarios/01-short-conversation.js';
import { runCommandsResume } from './scenarios/02-commands-resume.js';
import { runTypingRace } from './scenarios/03-typing-race.js';
import { runDualOpen } from './scenarios/04-dual-open.js';
import { runAlternatingLoad } from './scenarios/05-alternating-load.js';

interface RawPlatform {
  id: string;
  type: string;
  botName: string;
  token: string;
  channelId: string;
  url?: string;
}

/** Remove fake-pattern test sessions from sessions.json (keeps real ones). */
function purgeTestSessions(): void {
  const sp = join(homedir(), '.config', 'claude-threads', 'sessions.json');
  try {
    const d = JSON.parse(readFileSync(sp, 'utf8')) as { sessions?: Record<string, unknown> };
    if (!d.sessions) return;
    const fake = /:p\d{6}([a-z0-9]{5,6}|xrealtest)$/;
    let removed = 0;
    for (const k of Object.keys(d.sessions)) {
      if (fake.test(k)) {
        delete d.sessions[k];
        removed++;
      }
    }
    if (removed) {
      writeFileSync(sp, JSON.stringify(d, null, 2));
      info(`Cleared ${removed} leftover test session(s) from a prior run.`);
    }
  } catch {
    /* no sessions file yet — nothing to purge */
  }
}

const which = (process.argv[2] || '01').toLowerCase();
const cfgPath = join(homedir(), '.config', 'claude-threads', 'config.yaml');
const sessionsPath = join(homedir(), '.config', 'claude-threads', 'sessions.json');
const cfg = yaml.load(readFileSync(cfgPath, 'utf8')) as { workingDir: string; platforms: RawPlatform[] };
const mm = (cfg.platforms || []).filter((p) => p.type === 'mattermost');
if (mm.length < 2) {
  warn(`Need ≥2 Mattermost bots in the config (found ${mm.length}).`);
  process.exit(1);
}
const channelId = mm[0].channelId;

// Bind the fake on a fixed port so you can point the bots at it.
const wantPort = Number(process.env.REALTEST_FAKE_PORT || 8065);
let fake: FakeMattermost | undefined;
for (let port = wantPort; port < wantPort + 10; port++) {
  try {
    const f = new FakeMattermost(channelId, port);
    await f.start();
    fake = f;
    break;
  } catch {
    /* port busy — try next */
  }
}
if (!fake) {
  warn(`Could not bind a port near ${wantPort}. Set REALTEST_FAKE_PORT to a free port.`);
  process.exit(1);
}

// Clear leftover TEST sessions from prior runs so the bot doesn't resume stale
// ones (pollutes results) or hit MAX_SESSIONS. Only fake-pattern threads are
// removed ("<platformId>:p<NNNNNN><tag>"); real Mattermost sessions are kept.
purgeTestSessions();

const human = fake.addUser('realtest_driver', false);
for (const p of mm) fake.addExistingBot(p.botName, p.token);
// URLs that aren't this fake — i.e. a real server to point back to afterwards.
const realUrls = [...new Set(mm.map((p) => p.url).filter((u): u is string => !!u && u !== fake.url))];

heading('realtest LIVE — repoint your bots to the fake');
info('');
info(`  1. Point BOTH bots' Server URL to:   ${fake.url}`);
info('     (keep tokens / channel / everything else unchanged)');
info('  2. Easiest: edit ~/.config/claude-threads/config.yaml — change the two');
info(`     "url:" lines to ${fake.url} — then restart \`bun dev\`.`);
info('     (or use the console edit-connection form to hot-reload each bot)');
info('');
info(`  Waiting for both bots to connect here (channel ${channelId})…`);

// Wait for the two bots to connect their websockets.
const start = Date.now();
const timeoutMs = 300000; // 5 min for you to repoint + restart
while (fake.connectedCount() < mm.length) {
  if (Date.now() - start > timeoutMs) {
    warn('Timed out waiting for the bots to connect. Did you repoint the URL + restart?');
    await fake.stop();
    process.exit(1);
  }
  await sleep(1000);
}
pass(`Both bots connected: @${mm.map((p) => p.botName).join(', @')}`);

const bots: ScenarioBot[] = mm.map((p) => ({ platformId: p.id, botName: p.botName }));
const ctx = contextFromFake(fake, human.id, bots, cfg.workingDir, sessionsPath);

let failed = false;
try {
  if (which === '01' || which === 'short' || which === 'all') await runShortConversation(ctx);
  if (which === '02' || which === 'commands' || which === 'all' || which === '23') await runCommandsResume(ctx);
  if (which === '03' || which === 'race' || which === 'all' || which === '23') await runTypingRace(ctx);
  if (which === '04' || which === 'dual' || which === 'all' || which === '45') await runDualOpen(ctx);
  if (which === '05' || which === 'alt' || which === 'all' || which === '45') await runAlternatingLoad(ctx);
} catch (err) {
  failed = true;
  warn(`Scenario aborted: ${err instanceof Error ? err.stack || err.message : String(err)}`);
} finally {
  await fake.stop();
}

heading('Done');
if (realUrls.length) {
  warn(`Remember to point your bots' Server URL back to: ${realUrls.join(' / ')}  (and restart \`bun dev\`).`);
}
process.exit(failed ? 1 : 0);
