/**
 * Per-session opencode SSE event stream.
 *
 * opencode's `/event` stream is PROJECT-SCOPED: it must be subscribed with the
 * session's `directory`, and it then carries every event of that project (all
 * its sessions). Without the `directory` query the server falls back to the
 * project of its own cwd — a subscriber for a session elsewhere receives only
 * `server.connected`/heartbeats and looks deceptively alive while every session
 * event is missing. Rather than one shared subscription demultiplexed to all
 * sessions (a single point of failure: one dead consume loop darkens every
 * bot), each `OpencodeAgent` owns ONE of these, subscribed with its own
 * directory and filtered to its own `sessionID`. This
 * mirrors the Claude backend's one-process-per-session isolation: a stalled or
 * dropped stream self-heals for that session alone and never affects peers.
 *
 * Resilience: the subscription can silently stall or die (observed: one
 * established the instant the embedded server comes up can hand back a dead
 * stream). Without recovery the session delivers nothing until a full bot
 * restart — responses are generated on the server (with cost) but never posted.
 * So we VERIFY each subscription is live (opencode emits `server.connected`
 * immediately; a stream silent for LIVENESS_MS is discarded and re-subscribed)
 * and self-heal forever on end / error / STALL.
 */

import type { Event } from '@opencode-ai/sdk';
import type { createLogger } from '../utils/logger.js';

type Logger = ReturnType<typeof createLogger>;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Event-subscription resilience knobs (see subscribeLive / runLoop).
export const INITIAL_SUBSCRIBE_ATTEMPTS = 5; // bounded at startup so start() can fail-fast
export const LIVENESS_MS = 4000;             // a healthy subscription emits server.connected at once
export const STALL_MS = 45_000;              // no events this long on a live stream → reconnect
export const RECONNECT_DELAY_MS = 1000;

/** Extract the owning session id from any opencode event, or undefined. */
export function sessionIdOf(event: Event): string | undefined {
  const props = (event as { properties?: Record<string, unknown> }).properties;
  if (!props) return undefined;
  const p = props as {
    sessionID?: string;
    part?: { sessionID?: string };
    info?: { sessionID?: string; id?: string };
  };
  // message.part.updated → part.sessionID; message.updated → info.sessionID;
  // everything else we translate (todo.updated, session.idle/error) → sessionID.
  return p.sessionID ?? p.part?.sessionID ?? p.info?.sessionID;
}

/**
 * Minimal shape of the opencode client's event API this stream needs — lets
 * unit tests supply a fake client without the whole SDK surface.
 */
export interface EventSubscribeClient {
  event: {
    subscribe: (options?: { query?: { directory?: string } }) => Promise<{ stream: AsyncIterable<Event> }>;
  };
}

/**
 * Fail-fast reachability check: a live opencode server emits an event
 * (`server.connected`) the instant you subscribe, so a healthy server yields
 * within `ms`. Rejects if the subscribe call errors (server down / wrong port)
 * or the stream produces nothing in the window (reachable socket but dead/wrong
 * server). Used once at startup so a bad server surfaces immediately instead of
 * ~25s later when the first agent tries to subscribe.
 */
export async function probeLive(client: EventSubscribeClient, ms = LIVENESS_MS): Promise<void> {
  const events = await client.event.subscribe(); // throws if the server is unreachable
  const iterator = events.stream[Symbol.asyncIterator]();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), ms);
  });
  try {
    const first = await Promise.race([iterator.next(), timeout]);
    if (first === 'timeout' || first.done) {
      throw new Error(`no events within ${ms}ms (server unreachable or dead)`);
    }
  } finally {
    if (timer) clearTimeout(timer);
    try { await iterator.return?.(); } catch { /* best-effort close of the probe */ }
  }
}

export class OpencodeSessionStream {
  private stopped = false;
  private started = false;

  constructor(
    private readonly client: EventSubscribeClient,
    private readonly sessionId: string,
    /**
     * The session's working directory. `/event` is PROJECT-SCOPED: without a
     * `directory` query the server only streams events for the project of its
     * own cwd — sessions in any other directory produce nothing (while
     * `server.connected`/heartbeats still arrive, so the stream looks live).
     */
    private readonly directory: string,
    private readonly onEvent: (event: Event) => void,
    private readonly log: Logger,
  ) {}

  /**
   * Establish a VERIFIED-LIVE subscription, then consume it in the background,
   * self-healing forever. Awaiting this resolves once the stream is live (so the
   * caller's first prompt never races a dead stream); it rejects only if no live
   * subscription can be established up front. Idempotent.
   */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const initial = await this.subscribeLive(INITIAL_SUBSCRIBE_ATTEMPTS);
    void this.runLoop(initial);
  }

  /** Stop consuming and re-subscribing (on session kill / bot teardown). */
  stop(): void {
    this.stopped = true;
  }

  /** Consume the stream, reconnecting on any end / error / stall. */
  private async runLoop(initialStream: AsyncIterable<Event>): Promise<void> {
    let stream: AsyncIterable<Event> | null = initialStream;
    while (!this.stopped && stream) {
      try {
        await this.consumeWithWatchdog(stream);
        if (this.stopped) return;
        this.log.warn('opencode event stream ended; reconnecting');
      } catch (err) {
        if (this.stopped) return;
        this.log.warn(
          `opencode event stream lost (${err instanceof Error ? err.message : String(err)}); reconnecting`,
        );
      }
      // Retry forever (attempts <= 0) on reconnect; null only when stopped.
      stream = await this.subscribeLive(0).catch(() => null);
    }
  }

  /**
   * Subscribe and VERIFY the stream is live: opencode emits an event
   * (`server.connected`) immediately, so a healthy stream yields within
   * LIVENESS_MS. A stream that produces nothing in that window is the dead
   * subscription we must avoid — discard it and re-subscribe. The verified first
   * event is dispatched here (filtered like any other), then the live iterator
   * is returned for the ongoing consume loop. `attempts <= 0` retries until
   * `stopped`.
   */
  private async subscribeLive(attempts: number): Promise<AsyncIterable<Event>> {
    for (let i = 0; !this.stopped && (attempts <= 0 || i < attempts); i++) {
      if (i > 0) await delay(RECONNECT_DELAY_MS);
      let iterator: AsyncIterator<Event>;
      try {
        const events = await this.client.event.subscribe({ query: { directory: this.directory } });
        iterator = events.stream[Symbol.asyncIterator]();
      } catch (err) {
        this.log.warn(`opencode subscribe failed: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }
      const first = await this.nextWithin(iterator, LIVENESS_MS);
      if (first === 'timeout' || first.done) {
        this.log.warn('opencode subscription produced no initial event; re-subscribing');
        try { await iterator.return?.(); } catch { /* best-effort */ }
        continue;
      }
      if (i > 0) this.log.info('opencode event stream reconnected');
      this.dispatch(first.value);
      return { [Symbol.asyncIterator]: () => iterator };
    }
    throw new Error('could not establish a live opencode event subscription');
  }

  /** `iterator.next()` racing a timeout; resolves to `'timeout'` if it stalls. */
  private async nextWithin(
    iterator: AsyncIterator<Event>,
    ms: number,
  ): Promise<IteratorResult<Event> | 'timeout'> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), ms);
    });
    try {
      return await Promise.race([iterator.next(), timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /**
   * Iterate the stream, dispatching events, with a stall watchdog: if no event
   * arrives within STALL_MS, throw so the caller reconnects. Always closes the
   * iterator on exit so the dead SSE connection is released.
   */
  private async consumeWithWatchdog(stream: AsyncIterable<Event>): Promise<void> {
    const iterator = stream[Symbol.asyncIterator]();
    try {
      while (!this.stopped) {
        const result = await this.nextWithin(iterator, STALL_MS);
        if (result === 'timeout') throw new Error(`no events for ${STALL_MS}ms`);
        if (result.done) return; // stream ended cleanly
        this.dispatch(result.value);
      }
    } finally {
      try {
        await iterator.return?.();
      } catch {
        // ignore — best-effort close of a possibly-dead stream
      }
    }
  }

  /** Deliver one event to this session's handler — ignore all other sessions. */
  private dispatch(event: Event): void {
    if (sessionIdOf(event) !== this.sessionId) return;
    try {
      this.onEvent(event);
    } catch (err) {
      this.log.error(`opencode event handler for ${this.sessionId} threw: ${err}`);
    }
  }
}
