/**
 * Shared opencode server process.
 *
 * Unlike the Claude Code CLI — one child process per session — opencode uses a
 * client/server model where a single `opencode serve` process hosts many
 * sessions concurrently. So the whole bot shares ONE server process and ONE
 * `OpencodeClient`.
 *
 * What it does NOT share is the event subscription. opencode's `/event` stream
 * is project-scoped (by `directory`), and each `OpencodeAgent` opens its OWN
 * `OpencodeSessionStream` (subscribed with its working directory, filtered to
 * its `sessionID`) so a dead/stalled stream self-heals per session
 * and never darkens other bots — the same failure isolation Claude gets from a
 * process per session. This module owns only the lazily-started server process
 * and the client; `openStream()` is the seam that hands agents their per-session
 * subscription.
 *
 * Start is idempotent and concurrency-safe (a single in-flight init promise).
 */

import { createOpencodeServer, createOpencodeClient } from '@opencode-ai/sdk';
import type { OpencodeClient, Event } from '@opencode-ai/sdk';
import { execSync } from 'child_process';
import { dirname, delimiter } from 'path';
import { createLogger } from '../utils/logger.js';
import { getOpencodePath } from './version-check.js';
import { OpencodeSessionStream, probeLive } from './event-stream.js';

const log = createLogger('opencode');

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Free a port held by a LEFTOVER opencode server so we can start a fresh one
 * (picking up any config/model changes). We only SIGKILL a process whose
 * command line is opencode — never an unrelated service on the port. Unix-only
 * (uses `lsof`/`ps`); returns false on Windows or when nothing was killed, in
 * which case the caller falls back to reusing whatever is there.
 */
function reclaimOpencodePort(port: number): boolean {
  if (process.platform === 'win32') return false;
  try {
    const pids = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: 'utf8', timeout: 4000 })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    let killed = false;
    for (const pid of pids) {
      try {
        const cmd = execSync(`ps -o command= -p ${pid}`, { encoding: 'utf8', timeout: 4000 });
        if (!/opencode/i.test(cmd)) continue; // don't kill unrelated services
        process.kill(Number(pid), 'SIGKILL');
        log.debug(`Killed leftover opencode server pid=${pid} on port ${port}`);
        killed = true;
      } catch {
        // process gone or ps/kill failed — ignore, best-effort
      }
    }
    return killed;
  } catch {
    // lsof missing or nothing listening — nothing to reclaim
    return false;
  }
}

/**
 * Ensure the SDK's `createOpencodeServer` (which spawns a bare `opencode`,
 * resolved via PATH) picks the SAME binary our version check validated /
 * `OPENCODE_PATH` points to. Without this, a host with multiple `opencode`
 * installs could serve from a different (older) binary than we vetted. We
 * prepend the resolved binary's directory to PATH; no-op when it's already
 * first or the path is a bare name.
 */
function alignOpencodeOnPath(): void {
  const bin = getOpencodePath();
  if (!bin.includes('/') && !bin.includes('\\')) return; // bare name → leave PATH as-is
  const dir = dirname(bin);
  const parts = (process.env.PATH ?? '').split(delimiter);
  if (parts[0] === dir) return;
  process.env.PATH = [dir, ...parts.filter((p) => p !== dir)].join(delimiter);
  log.debug(`Prepended ${dir} to PATH so the opencode server spawns from ${bin}`);
}

export class OpencodeServer {
  private server: { url: string; close(): void } | null = null;
  private clientInstance: OpencodeClient | null = null;
  private initPromise: Promise<OpencodeClient> | null = null;

  /** The shared client, or null before the first successful `ensureStarted()`. */
  get client(): OpencodeClient | null {
    return this.clientInstance;
  }

  /**
   * Start the server + client once. Concurrent callers share the same in-flight
   * init. Throws if the `opencode` binary can't be started (missing /
   * incompatible).
   */
  ensureStarted(): Promise<OpencodeClient> {
    if (this.clientInstance) return Promise.resolve(this.clientInstance);
    if (this.initPromise) return this.initPromise;
    // Do NOT cache a rejected init: clear it so a later message retries. Caching
    // a rejection would kill opencode for the whole process lifetime after one
    // transient failure (e.g. the port was briefly occupied during a restart).
    this.initPromise = this.init().catch((err) => {
      this.initPromise = null;
      throw err;
    });
    return this.initPromise;
  }

  private async init(): Promise<OpencodeClient> {
    alignOpencodeOnPath();
    // opencode listens on 4096 by default. If that collides with a developer's
    // own `opencode serve`, set OPENCODE_PORT to a free port.
    const port = Number(process.env.OPENCODE_PORT ?? '4096');
    const hostname = '127.0.0.1';
    let url: string;
    try {
      log.debug(`Starting opencode server (port=${port})`);
      this.server = await createOpencodeServer({ hostname, port });
      url = this.server.url;
      log.info(`opencode server listening at ${url}`);
    } catch {
      // Port occupied — almost always our OWN opencode server left over from a
      // previous run (a `bun --watch` reload or a fast restart skips/outruns our
      // graceful shutdown, which only SIGTERMs without waiting). Reclaim it and
      // start fresh, so config/model changes actually take effect — reusing the
      // stale server would silently keep running the OLD model.
      const reclaimed = reclaimOpencodePort(port);
      if (reclaimed) {
        await delay(400); // let the OS release the port after SIGKILL
      }
      try {
        log.warn(
          reclaimed
            ? `Reclaimed port ${port} from a leftover opencode server; starting fresh`
            : `Port ${port} busy and no reclaimable opencode process found; retrying spawn`,
        );
        this.server = await createOpencodeServer({ hostname, port });
        url = this.server.url;
        log.info(`opencode server listening at ${url}`);
      } catch (retryErr) {
        // Last resort: connect to whatever is on the port (may be the user's own
        // `opencode serve`, or a server we couldn't kill). It might run a stale
        // config, but a working bot beats a dead one. Each agent's stream
        // subscription below validates reachability and surfaces a dead server.
        this.server = null; // not ours → shutdown() must not close it
        url = `http://${hostname}:${port}`;
        log.warn(
          `Could not start a fresh opencode server (${String(retryErr).split('\n')[0]}); ` +
          `reusing the existing server at ${url} (it may run an outdated config)`,
        );
      }
    }
    const client = createOpencodeClient({ baseUrl: url });

    // Fail-fast reachability check: verify the server is actually alive before
    // handing out the client. Critical for the reuse-fallback branch above
    // (connecting to a pre-existing server that might be dead/wrong) — without
    // it a bad server only surfaces ~25s later at the first agent's subscribe.
    // On failure init rejects and clientInstance stays null (the getter never
    // hands out a dead client); ensureStarted() clears initPromise so a later
    // message retries.
    try {
      await probeLive(client);
    } catch (err) {
      throw new Error(
        `opencode server at ${url} is not reachable: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    this.clientInstance = client;
    return client;
  }

  /**
   * Open a per-session event subscription. The agent owns the returned stream's
   * lifetime: it must `start()` it (awaitable — resolves once live) and `stop()`
   * it on teardown. Throws if the server hasn't been started yet.
   */
  openStream(
    sessionId: string,
    directory: string,
    onEvent: (event: Event) => void,
    logger: ReturnType<typeof createLogger>,
  ): OpencodeSessionStream {
    if (!this.clientInstance) throw new Error('opencode server not started');
    return new OpencodeSessionStream(this.clientInstance, sessionId, directory, onEvent, logger);
  }

  /** Shut the server down (bot exit). Safe to call when never started. */
  async shutdown(): Promise<void> {
    try {
      this.server?.close();
    } catch (err) {
      log.debug(`Error closing opencode server: ${err}`);
    }
    this.server = null;
    this.clientInstance = null;
    this.initPromise = null;
  }
}

/** Process-wide singleton — every session shares this one server process. */
export const opencodeServer = new OpencodeServer();
