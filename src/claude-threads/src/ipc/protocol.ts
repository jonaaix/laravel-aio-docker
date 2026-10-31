/**
 * Control-channel wire protocol.
 *
 * Two message streams over one socket, both newline-delimited JSON:
 *
 *  - {@link ServerEvent}: server → client. Mirrors the `UIOperations` surface
 *    (the server's authoritative UI state) plus a one-shot `snapshot` sent
 *    right after connect so a freshly-attached console starts fully populated.
 *  - {@link ClientCommand}: client → server. Mirrors `ToggleCallbacks` plus
 *    management actions. The server routes these into the exact same callbacks
 *    the local TUI uses, so a remote console is indistinguishable from the
 *    in-process one.
 *
 * `Date` fields are serialized as ISO strings by JSON; {@link reviveServerEvent}
 * turns them back into `Date` on the client so the Ink components (which format
 * dates) keep working.
 */
import type {
  SessionInfo,
  LogEntry,
  PlatformStatus,
  UpdatePanelState,
  ToggleState,
  AppConfig,
} from '../ui/types.js';
import type { PermissionMode, PlatformInstanceConfig, EditableGlobalSettings } from '../config/index.js';

/** One-shot full state sent immediately after a client connects. */
export interface Snapshot {
  config: AppConfig;
  toggles: ToggleState;
  sessions: SessionInfo[];
  platforms: PlatformStatus[];
  logs: LogEntry[];
  update: UpdatePanelState | null;
  ready: boolean;
  shuttingDown: boolean;
  /** Configured connections, secrets redacted — for the edit form. */
  connections: PlatformInstanceConfig[];
  /** Editable bot-wide settings — for the settings form. */
  settings: EditableGlobalSettings;
}

export type ServerEvent =
  | { t: 'hello'; version: string; pid: number }
  | { t: 'snapshot'; snapshot: Snapshot }
  | { t: 'ready' }
  | { t: 'shuttingDown' }
  | { t: 'session:add'; session: SessionInfo }
  | { t: 'session:update'; sessionId: string; updates: Partial<SessionInfo> }
  | { t: 'session:remove'; sessionId: string }
  | { t: 'log'; entry: LogEntry }
  | { t: 'platform'; platformId: string; status: Partial<PlatformStatus> }
  | { t: 'update'; state: UpdatePanelState }
  | { t: 'toggles'; toggles: ToggleState }
  /** Updated connection list (secrets redacted) after a save/remove. */
  | { t: 'connections'; connections: PlatformInstanceConfig[] }
  /** Updated global settings after a save. */
  | { t: 'settings'; settings: EditableGlobalSettings }
  /** Outcome of a connection:save / connection:remove command. */
  | { t: 'connection:result'; id: string; ok: boolean; error?: string }
  /** Server is going away (shutdown / restart). Client should detach cleanly. */
  | { t: 'bye'; reason: string };

export type ClientCommand =
  // Toggles — mirror ToggleCallbacks
  | { t: 'toggle:debug'; enabled: boolean }
  | { t: 'toggle:permissions'; mode: PermissionMode }
  | { t: 'toggle:chrome'; enabled: boolean }
  | { t: 'toggle:keepAlive'; enabled: boolean }
  | { t: 'toggle:platform'; platformId: string; enabled: boolean }
  | { t: 'forceUpdate' }
  // Management actions. sessionId is the composite "platformId:threadId".
  | { t: 'session:cancel'; sessionId: string }
  | { t: 'session:interrupt'; sessionId: string }
  // Connection management (add or update by id, remove by id).
  | { t: 'connection:save'; config: PlatformInstanceConfig }
  | { t: 'connection:remove'; id: string }
  // Global settings.
  | { t: 'settings:save'; settings: EditableGlobalSettings }
  | { t: 'server:stop' };

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

export function encode(msg: ServerEvent | ClientCommand): string {
  return JSON.stringify(msg) + '\n';
}

/**
 * Incremental newline-delimited JSON parser. Feed it raw socket chunks; it
 * emits one parsed object per complete line. Malformed lines are skipped (a
 * partial write followed by a reconnect must not wedge the stream).
 */
export class LineDecoder {
  private buf = '';

  push(chunk: string | Buffer, onMessage: (obj: unknown) => void): void {
    this.buf += chunk.toString('utf8');
    let idx: number;
    while ((idx = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + 1);
      if (!line.trim()) continue;
      try {
        onMessage(JSON.parse(line));
      } catch {
        // Skip malformed line — never let one bad frame kill the connection.
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Date revival (client side)
// ---------------------------------------------------------------------------

function reviveDate<T>(obj: T, key: keyof T): void {
  const v = obj[key] as unknown;
  if (typeof v === 'string') {
    (obj[key] as unknown) = new Date(v);
  }
}

function reviveSession(s: SessionInfo): SessionInfo {
  reviveDate(s, 'lastActivity');
  return s;
}

function reviveLog(l: LogEntry): LogEntry {
  reviveDate(l, 'timestamp');
  return l;
}

function reviveUpdate(u: UpdatePanelState): UpdatePanelState {
  reviveDate(u, 'scheduledRestartAt');
  reviveDate(u, 'deferredUntil');
  return u;
}

/**
 * Restore `Date` instances on an incoming server event, in place. Returns the
 * same object typed as {@link ServerEvent}.
 */
export function reviveServerEvent(obj: unknown): ServerEvent {
  const ev = obj as ServerEvent;
  switch (ev.t) {
    case 'snapshot':
      ev.snapshot.sessions.forEach(reviveSession);
      ev.snapshot.logs.forEach(reviveLog);
      if (ev.snapshot.update) reviveUpdate(ev.snapshot.update);
      break;
    case 'session:add':
      reviveSession(ev.session);
      break;
    case 'session:update':
      if (ev.updates.lastActivity !== undefined) reviveDate(ev.updates, 'lastActivity');
      break;
    case 'log':
      reviveLog(ev.entry);
      break;
    case 'update':
      reviveUpdate(ev.state);
      break;
  }
  return ev;
}
