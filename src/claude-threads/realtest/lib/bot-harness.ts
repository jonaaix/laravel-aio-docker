/**
 * realtest — spin up an ISOLATED claude-threads bot process wired to the fake
 * Mattermost, without disturbing the operator's running `bun dev` instance.
 *
 * Isolation strategy: give the child its own HOME (a temp dir). The bot keeps
 * all state under HOME (`~/.config/claude-threads`, control socket, sessions,
 * logs), so a temp HOME fully separates it from the real instance and never
 * touches the real config. We symlink the child's `~/.claude` to the real one
 * so the child's `claude` sessions use the real credentials AND write their
 * transcripts to the real projects dir (where our analysis reads them).
 *
 * The bots run headless, on real LLMs, pointed at the fake server.
 */
import { spawn, type ChildProcess } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, existsSync, openSync, readFileSync, copyFileSync } from 'fs';
import { tmpdir, homedir } from 'os';
import { join, resolve } from 'path';
import yaml from 'js-yaml';
import { FakeMattermost, type FakeUser } from './fake-mattermost.js';
import { sleep } from './mm.js';

export interface BotHarnessOptions {
  /** LLM model for both bots (e.g. 'sonnet', 'haiku'). */
  model?: string;
  /** Names for the two bots (must be valid @mention handles). */
  botNames?: [string, string];
  /** Seconds to wait for both bots to connect. */
  connectTimeoutMs?: number;
  /**
   * Per-bot writeScope [botA, botB]. Omit → both default (workingDir-confined).
   * Set e.g. ['unrestricted', 'workingDir'] to exercise the chief/confined
   * split (chief authority block on A, write-scope + hand-off to A on B).
   */
  writeScopes?: [string | undefined, string | undefined];
}

export interface BotHarness {
  fake: FakeMattermost;
  human: FakeUser;
  bots: FakeUser[];
  /** sessions.json path for the isolated child (thread → claudeSessionId). */
  sessionsPath: string;
  /** working dir the child's claude sessions run in (→ transcript location). */
  workingDir: string;
  logPath: string;
  stop: () => Promise<void>;
}

/**
 * Start the fake server + an isolated bot child, and wait for both bots to
 * connect. Throws (with the child log tail) if they don't come up in time.
 */
export async function startBotHarness(opts: BotHarnessOptions = {}): Promise<BotHarness> {
  const model = opts.model ?? 'sonnet';
  const [nameA, nameB] = opts.botNames ?? ['realtest_bot_a', 'realtest_bot_b'];
  const repoRoot = resolve(import.meta.dir, '..', '..');

  // Fake server + users.
  const fake = new FakeMattermost();
  await fake.start();
  const human = fake.addUser('realtest_driver', false);
  const botA = fake.addUser(nameA, true);
  const botB = fake.addUser(nameB, true);

  // Isolated HOME. Two things make the child's `claude` usable:
  //  - symlink ~/.claude → real (settings + where transcripts get written; the
  //    OAuth token itself lives in the macOS Keychain, which is HOME-independent).
  //  - copy ~/.claude.json (login/onboarding/account state) so claude knows it's
  //    logged in. We COPY (not symlink) so the child mutates its own copy and
  //    never contends with the real running instance.
  const home = mkdtempSync(join(tmpdir(), 'ct-realtest-home-'));
  symlinkSync(join(homedir(), '.claude'), join(home, '.claude'));
  const realClaudeJson = join(homedir(), '.claude.json');
  if (existsSync(realClaudeJson)) copyFileSync(realClaudeJson, join(home, '.claude.json'));
  const workingDir = mkdtempSync(join(tmpdir(), 'ct-realtest-cwd-'));
  const cfgDir = join(home, '.config', 'claude-threads');
  mkdirSync(cfgDir, { recursive: true });
  const sessionsPath = join(cfgDir, 'sessions.json');

  const config = {
    version: 2,
    workingDir,
    chrome: false,
    worktreeMode: 'off',
    autoUpdate: { enabled: false },
    platforms: [botA, botB].map((b, i) => ({
      id: i === 0 ? 'bot-a' : 'bot-b',
      type: 'mattermost',
      displayName: b.username,
      url: fake.url,
      token: b.token,
      channelId: fake.channelId,
      botName: b.username,
      allowedUsers: [] as string[], // anyone → the human driver is allowed
      permissionMode: 'bypass', // chat-only; never block on a permission prompt
      model,
      sessionHeader: 'hidden',
      stickyMessage: 'hidden',
      description: i === 0 ? 'realtest bot A' : 'realtest bot B',
      ...(opts.writeScopes?.[i] ? { writeScope: opts.writeScopes[i] } : {}),
    })),
  };
  writeFileSync(join(cfgDir, 'config.yaml'), yaml.dump(config));

  // Spawn the bot from source, headless, with the isolated HOME.
  const logPath = join(home, 'bot.log');
  const logFd = openSync(logPath, 'a');
  const child: ChildProcess = spawn(process.execPath, [join(repoRoot, 'src', 'index.ts'), '--headless'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: home,
      USERPROFILE: home,
      CLAUDE_THREADS_INTERACTIVE: '',
    },
    stdio: ['ignore', logFd, logFd],
  });

  const stop = async (): Promise<void> => {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    await sleep(500);
    try {
      if (child.exitCode === null) child.kill('SIGKILL');
    } catch {
      /* ignore */
    }
    await fake.stop();
    // Remove temp dirs. rmSync does not follow the .claude symlink's target.
    for (const dir of [home, workingDir]) {
      try {
        if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  };

  // Wait for both bots to authenticate their websockets.
  const timeout = opts.connectTimeoutMs ?? 30000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (fake.connectedCount() >= 2) {
      return { fake, human, bots: [botA, botB], sessionsPath, workingDir, logPath, stop };
    }
    if (child.exitCode !== null) break;
    await sleep(500);
  }
  const tail = safeTail(logPath);
  await stop();
  throw new Error(`Bots did not connect to the fake server within ${timeout}ms.\n--- bot.log tail ---\n${tail}`);
}

function safeTail(path: string): string {
  try {
    return readFileSync(path, 'utf8').split('\n').slice(-25).join('\n');
  } catch {
    return '(no log)';
  }
}
