/**
 * ControlServer — the authoritative side of the control channel.
 *
 * The bot process opens exactly one of these. It listens on the control socket,
 * pushes a {@link Snapshot} + live {@link ServerEvent}s to every attached
 * console, and forwards each incoming {@link ClientCommand} to `onCommand`
 * (which routes into the same toggle callbacks the local TUI uses).
 *
 * Liveness contract: a client decides "is a server up?" by connecting. So the
 * server must (a) clean up a stale POSIX socket file left by a crashed instance
 * before listening, and (b) remove its socket + lockfile on clean shutdown.
 */
import net from 'net';
import { existsSync, unlinkSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { controlSocketPath, controlLockPath, controlDir } from './paths.js';
import {
  encode,
  LineDecoder,
  type ServerEvent,
  type ClientCommand,
  type Snapshot,
} from './protocol.js';

export interface ControlServerOptions {
  version: string;
  /** Produce the current authoritative state for a newly-attached console. */
  getSnapshot: () => Snapshot;
  /** Handle a command from an attached console. */
  onCommand: (cmd: ClientCommand) => void;
  /** Optional sink for diagnostic logs. */
  log?: (msg: string) => void;
  /** Override the socket path (tests). Defaults to the shared control socket. */
  socketPath?: string;
}

export class ControlServer {
  private server: net.Server | null = null;
  private clients = new Set<net.Socket>();
  private readonly socketPath: string;
  private closed = false;

  /** True when using the shared control socket (not a test override). */
  private readonly usesDefaultPath: boolean;

  constructor(private readonly opts: ControlServerOptions) {
    this.socketPath = opts.socketPath ?? controlSocketPath();
    this.usesDefaultPath = opts.socketPath === undefined;
  }

  /**
   * Start listening. Rejects only on an unrecoverable error; a stale POSIX
   * socket file is unlinked and retried once.
   */
  async listen(): Promise<void> {
    this.ensureDir();
    await this.listenOnce(true);
    if (this.usesDefaultPath) this.writeLock();
  }

  private ensureDir(): void {
    // Only manage the shared config dir; a test override supplies its own dir.
    if (!this.usesDefaultPath) return;
    const dir = controlDir();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  private listenOnce(allowRetry: boolean): Promise<void> {
    return new Promise((resolvePromise, reject) => {
      const server = net.createServer((socket) => this.onConnection(socket));
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE' && allowRetry && process.platform !== 'win32') {
          // Stale socket from a crashed instance: our caller already verified
          // no live server answered, so it's safe to remove and retry once.
          try {
            if (existsSync(this.socketPath)) unlinkSync(this.socketPath);
          } catch {
            /* fall through to retry; if it still fails we reject below */
          }
          this.listenOnce(false).then(resolvePromise, reject);
          return;
        }
        reject(err);
      });
      server.listen(this.socketPath, () => {
        this.server = server;
        // Owner-only on POSIX so another user can't drive the bot.
        if (process.platform !== 'win32') {
          try {
            chmodSync(this.socketPath, 0o600);
          } catch {
            /* best effort */
          }
        }
        resolvePromise();
      });
    });
  }

  private writeLock(): void {
    try {
      writeFileSync(
        controlLockPath(),
        JSON.stringify({
          pid: process.pid,
          version: this.opts.version,
          socketPath: this.socketPath,
          startedAt: new Date().toISOString(),
        }),
        { mode: 0o600 },
      );
    } catch {
      /* advisory only */
    }
  }

  private onConnection(socket: net.Socket): void {
    this.clients.add(socket);
    socket.setEncoding('utf8');
    const decoder = new LineDecoder();

    socket.on('data', (chunk) => {
      decoder.push(chunk, (obj) => {
        try {
          this.opts.onCommand(obj as ClientCommand);
        } catch (err) {
          this.opts.log?.(`command handler error: ${String(err)}`);
        }
      });
    });
    const drop = () => this.clients.delete(socket);
    socket.on('close', drop);
    socket.on('error', drop);

    // Greet + full snapshot so the console renders immediately.
    this.sendTo(socket, { t: 'hello', version: this.opts.version, pid: process.pid });
    try {
      this.sendTo(socket, { t: 'snapshot', snapshot: this.opts.getSnapshot() });
    } catch (err) {
      this.opts.log?.(`snapshot failed: ${String(err)}`);
    }
  }

  private sendTo(socket: net.Socket, ev: ServerEvent): void {
    if (socket.writable) socket.write(encode(ev));
  }

  /** Push an event to every attached console. */
  broadcast(ev: ServerEvent): void {
    if (this.closed) return;
    const frame = encode(ev);
    for (const socket of this.clients) {
      if (socket.writable) socket.write(frame);
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }

  /** Tell consoles we're gone, close everything, and remove socket + lock. */
  async close(reason = 'server shutting down'): Promise<void> {
    if (this.closed) return;
    // Send `bye` while still open — broadcast() short-circuits once `closed`.
    this.broadcast({ t: 'bye', reason });
    this.closed = true;
    const sockets = Array.from(this.clients);
    this.clients.clear();
    // Graceful end first so the queued `bye` + FIN flush to consoles.
    for (const socket of sockets) {
      try {
        socket.end();
      } catch {
        /* ignore */
      }
    }
    await new Promise<void>((resolvePromise) => {
      if (!this.server) return resolvePromise();
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolvePromise();
        }
      };
      this.server.close(() => finish());
      // A console that keeps its half of the connection open would otherwise
      // stall server.close() indefinitely. Force-drop lingering sockets after
      // a short grace (long enough for `bye` to have flushed) so close() is
      // always bounded.
      setTimeout(() => {
        for (const socket of sockets) {
          try {
            socket.destroy();
          } catch {
            /* ignore */
          }
        }
        finish();
      }, 150).unref?.();
    });
    this.server = null;
    // Clean up filesystem artifacts: the POSIX socket file always, and the
    // lockfile only when we own the shared one.
    try {
      if (process.platform !== 'win32' && existsSync(this.socketPath)) {
        unlinkSync(this.socketPath);
      }
    } catch {
      /* best effort */
    }
    if (this.usesDefaultPath) {
      try {
        const lock = controlLockPath();
        if (existsSync(lock)) unlinkSync(lock);
      } catch {
        /* best effort */
      }
    }
  }
}
