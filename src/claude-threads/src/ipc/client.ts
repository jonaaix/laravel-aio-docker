/**
 * ControlClient — the console side of the control channel.
 *
 * {@link ControlClient.tryConnect} is the single-instance decision point:
 *
 *  - resolves with a connected client  → a server is up; run as a console.
 *  - resolves with `null`               → no live server; caller should start one.
 *
 * "Is a server up?" is answered by actually connecting and receiving the
 * server's `hello` frame — a stale POSIX socket file refuses the connection
 * (ECONNREFUSED) and correctly yields `null`.
 */
import net from 'net';
import { controlSocketPath } from './paths.js';
import {
  encode,
  LineDecoder,
  reviveServerEvent,
  type ServerEvent,
  type ClientCommand,
  type Snapshot,
} from './protocol.js';

/** How long to wait for the server's hello+snapshot before giving up. */
const HANDSHAKE_TIMEOUT_MS = 3000;

export class ControlClient {
  private eventCb: ((ev: ServerEvent) => void) | null = null;
  private closeCb: ((reason: string) => void) | null = null;
  private pending: ServerEvent[] = [];
  private closedReason: string | null = null;

  private constructor(
    private readonly socket: net.Socket,
    readonly serverVersion: string,
    readonly serverPid: number,
    readonly snapshot: Snapshot,
  ) {
    // Route post-handshake frames to the (eventually-registered) handler,
    // buffering anything that arrives before the caller wires up onEvent().
    const decoder = new LineDecoder();
    socket.on('data', (chunk) => {
      decoder.push(chunk, (obj) => this.dispatch(reviveServerEvent(obj)));
    });
    socket.on('close', () => this.handleClose(this.closedReason ?? 'connection closed'));
    socket.on('error', () => this.handleClose('connection error'));
  }

  private dispatch(ev: ServerEvent): void {
    if (ev.t === 'bye') this.closedReason = ev.reason;
    if (this.eventCb) this.eventCb(ev);
    else this.pending.push(ev);
  }

  private handleClose(reason: string): void {
    if (this.closeCb) this.closeCb(reason);
  }

  /**
   * Try to attach to a running server. Returns `null` if none is listening
   * (or if a socket exists but never completes the handshake).
   */
  static tryConnect(socketPath: string = controlSocketPath()): Promise<ControlClient | null> {
    return new Promise((resolvePromise) => {
      // Build the socket and attach the error handler BEFORE connecting — on
      // some runtimes (Bun) a bad path emits 'error' synchronously during the
      // connect call, which would otherwise surface as an unhandled error.
      const socket = new net.Socket();
      socket.setEncoding('utf8');

      let settled = false;
      const finish = (result: ControlClient | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolvePromise(result);
      };

      const timer = setTimeout(() => {
        socket.destroy();
        finish(null);
      }, HANDSHAKE_TIMEOUT_MS);

      // Collect frames until we have both hello and snapshot, then hand the
      // live socket off to a ControlClient instance.
      const decoder = new LineDecoder();
      let helloVersion: string | null = null;
      let helloPid = 0;
      socket.on('data', function onData(chunk) {
        decoder.push(chunk, (obj) => {
          const ev = reviveServerEvent(obj);
          if (ev.t === 'hello') {
            helloVersion = ev.version;
            helloPid = ev.pid;
          } else if (ev.t === 'snapshot' && helloVersion !== null) {
            socket.removeListener('data', onData);
            finish(new ControlClient(socket, helloVersion, helloPid, ev.snapshot as Snapshot));
          }
        });
      });

      socket.on('error', () => finish(null)); // ECONNREFUSED / ENOENT → no server
      socket.on('close', () => finish(null));

      socket.connect(socketPath);
    });
  }

  /** Register the live-event handler; flushes any frames buffered pre-registration. */
  onEvent(cb: (ev: ServerEvent) => void): void {
    this.eventCb = cb;
    if (this.pending.length) {
      const buffered = this.pending;
      this.pending = [];
      for (const ev of buffered) cb(ev);
    }
  }

  /** Register a handler for when the connection drops (server gone / detached). */
  onClose(cb: (reason: string) => void): void {
    this.closeCb = cb;
    if (this.closedReason && this.socket.destroyed) cb(this.closedReason);
  }

  /** Send a command to the server. */
  send(cmd: ClientCommand): void {
    if (this.socket.writable) this.socket.write(encode(cmd));
  }

  /** Detach without affecting the server. */
  close(): void {
    try {
      this.socket.end();
    } catch {
      /* ignore */
    }
  }
}
