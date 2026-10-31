/**
 * ServerBridge — turns the in-process UI boundary into a broadcastable one.
 *
 * Every server→UI mutation already flows through the {@link UIProvider}
 * (`UIOperations`) surface, and every UI→server action flows through
 * {@link ToggleCallbacks}. The bridge sits on both:
 *
 *  - {@link ServerBridge.wrapProvider} returns a UIProvider that delegates to
 *    the real one AND keeps an authoritative state copy + broadcasts each
 *    mutation to attached consoles. The rest of the app uses this wrapper.
 *  - {@link ServerBridge.wrapCallbacks} returns toggle callbacks that run the
 *    real logic AND broadcast the new toggle state — so a toggle flipped on the
 *    server's own terminal reaches remote consoles too.
 *  - Incoming client commands are routed back through those same callbacks, so
 *    a remote console is indistinguishable from the local one.
 *
 * Per-console UI state (`updateModalVisible`, `logsFocused`) is intentionally
 * NOT synced — each console owns its own modal/scroll state.
 */
import type {
  SessionInfo,
  LogEntry,
  PlatformStatus,
  UpdatePanelState,
  ToggleState,
  ToggleCallbacks,
  AppConfig,
} from '../ui/types.js';
import type { PermissionMode, PlatformInstanceConfig, EditableGlobalSettings } from '../config/index.js';
import type { UIProvider } from '../ui/providers/types.js';
import { ControlServer } from './server.js';
import type { ClientCommand, Snapshot } from './protocol.js';

/** Newest-N log entries kept for the connect-time snapshot. */
const LOG_SNAPSHOT_CAP = 1000;

/** Management-action handlers invoked by console commands. */
export interface ServerActionHandlers {
  cancelSession: (sessionId: string) => void;
  interruptSession: (sessionId: string) => void;
}

/**
 * Runtime connection-management handlers (per-client hot-reload). Registered
 * separately via {@link ServerBridge.setConnectionHandlers} because the
 * platform machinery is built after the bridge itself.
 */
export interface ConnectionHandlers {
  addOrUpdateConnection: (config: PlatformInstanceConfig) => Promise<{ ok: boolean; error?: string }>;
  removeConnection: (id: string) => Promise<{ ok: boolean; error?: string }>;
}

export interface ServerBridgeOptions {
  version: string;
  config: AppConfig;
  /** The real toggle callbacks (mutate runtime config, session manager, …). */
  callbacks: ToggleCallbacks;
  /** Session management actions (stop/interrupt), routed to the SessionManager. */
  actions: ServerActionHandlers;
  /** Current connections with secrets redacted (for the console edit form). */
  getConnections: () => PlatformInstanceConfig[];
  /** Current editable global settings (for the console settings form). */
  getSettings: () => EditableGlobalSettings;
  /** Persist + apply edited global settings. */
  onSaveSettings: (settings: EditableGlobalSettings) => void;
  /** Invoked when a console requests `server:stop`. */
  onServerStop: () => void;
  log?: (msg: string) => void;
  /** Override the control socket path (tests). */
  socketPath?: string;
}

export class ServerBridge {
  private control: ControlServer | null = null;
  private logCounter = 0;
  private connectionHandlers: ConnectionHandlers | null = null;

  // Authoritative state mirror (source for the connect-time snapshot).
  private sessions = new Map<string, SessionInfo>();
  private platforms = new Map<string, PlatformStatus>();
  private logs: LogEntry[] = [];
  private update: UpdatePanelState | null = null;
  private ready = false;
  private shuttingDown = false;
  /** Shared toggle subset (per-console modal/scroll state is excluded). */
  private toggles: Pick<
    ToggleState,
    'debugMode' | 'permissionMode' | 'chromeEnabled' | 'keepAliveEnabled'
  >;

  constructor(private readonly opts: ServerBridgeOptions) {
    this.toggles = {
      debugMode: process.env.DEBUG === '1',
      permissionMode: opts.config.permissionMode,
      chromeEnabled: opts.config.chromeEnabled,
      keepAliveEnabled: opts.config.keepAliveEnabled,
    };
  }

  // ---- callbacks --------------------------------------------------------

  /** Wrap the real callbacks so state changes also broadcast to consoles. */
  wrapCallbacks(): ToggleCallbacks {
    const cb = this.opts.callbacks;
    return {
      onDebugToggle: (enabled) => {
        this.toggles.debugMode = enabled;
        cb.onDebugToggle?.(enabled);
        this.broadcastToggles();
      },
      onPermissionsToggle: (mode) => {
        this.toggles.permissionMode = mode;
        cb.onPermissionsToggle?.(mode);
        this.broadcastToggles();
      },
      onChromeToggle: (enabled) => {
        this.toggles.chromeEnabled = enabled;
        cb.onChromeToggle?.(enabled);
        this.broadcastToggles();
      },
      onKeepAliveToggle: (enabled) => {
        this.toggles.keepAliveEnabled = enabled;
        cb.onKeepAliveToggle?.(enabled);
        this.broadcastToggles();
      },
      onPlatformToggle: (platformId, enabled) => {
        cb.onPlatformToggle?.(platformId, enabled);
      },
      onForceUpdate: () => {
        cb.onForceUpdate?.();
      },
    };
  }

  private broadcastToggles(): void {
    this.control?.broadcast({ t: 'toggles', toggles: this.snapshotToggles() });
  }

  private snapshotToggles(): ToggleState {
    return {
      ...this.toggles,
      updateModalVisible: false,
      logsFocused: false,
    };
  }

  // ---- command routing --------------------------------------------------

  private handleCommand(cmd: ClientCommand): void {
    const wrapped = this.wrapCallbacks();
    switch (cmd.t) {
      case 'toggle:debug':
        wrapped.onDebugToggle?.(cmd.enabled);
        break;
      case 'toggle:permissions':
        wrapped.onPermissionsToggle?.(cmd.mode as PermissionMode);
        break;
      case 'toggle:chrome':
        wrapped.onChromeToggle?.(cmd.enabled);
        break;
      case 'toggle:keepAlive':
        wrapped.onKeepAliveToggle?.(cmd.enabled);
        break;
      case 'toggle:platform':
        wrapped.onPlatformToggle?.(cmd.platformId, cmd.enabled);
        break;
      case 'forceUpdate':
        wrapped.onForceUpdate?.();
        break;
      case 'session:cancel':
        this.opts.actions.cancelSession(cmd.sessionId);
        break;
      case 'session:interrupt':
        this.opts.actions.interruptSession(cmd.sessionId);
        break;
      case 'connection:save': {
        const id = cmd.config.id;
        const handlers = this.connectionHandlers;
        if (!handlers) {
          this.control?.broadcast({ t: 'connection:result', id, ok: false, error: 'not ready' });
          break;
        }
        void handlers
          .addOrUpdateConnection(cmd.config)
          .then((r) => this.control?.broadcast({ t: 'connection:result', id, ...r }));
        break;
      }
      case 'connection:remove': {
        const handlers = this.connectionHandlers;
        if (!handlers) {
          this.control?.broadcast({ t: 'connection:result', id: cmd.id, ok: false, error: 'not ready' });
          break;
        }
        void handlers
          .removeConnection(cmd.id)
          .then((r) => this.control?.broadcast({ t: 'connection:result', id: cmd.id, ...r }));
        break;
      }
      case 'settings:save':
        this.opts.onSaveSettings(cmd.settings);
        this.broadcastSettings();
        break;
      case 'server:stop':
        this.opts.onServerStop();
        break;
    }
  }

  /** Register runtime connection-management handlers (see {@link ConnectionHandlers}). */
  setConnectionHandlers(handlers: ConnectionHandlers): void {
    this.connectionHandlers = handlers;
  }

  // ---- lifecycle --------------------------------------------------------

  /** Open the control socket. Safe to call once, after wrapProvider(). */
  async listen(): Promise<void> {
    this.control = new ControlServer({
      version: this.opts.version,
      getSnapshot: () => this.buildSnapshot(),
      onCommand: (cmd) => this.handleCommand(cmd),
      log: this.opts.log,
      socketPath: this.opts.socketPath,
    });
    await this.control.listen();
  }

  async close(reason?: string): Promise<void> {
    await this.control?.close(reason);
    this.control = null;
  }

  private buildSnapshot(): Snapshot {
    return {
      config: this.opts.config,
      toggles: this.snapshotToggles(),
      sessions: Array.from(this.sessions.values()),
      platforms: Array.from(this.platforms.values()),
      logs: this.logs,
      update: this.update,
      ready: this.ready,
      shuttingDown: this.shuttingDown,
      connections: this.opts.getConnections(),
      settings: this.opts.getSettings(),
    };
  }

  /** Broadcast the current (redacted) connection list to attached consoles. */
  broadcastConnections(): void {
    this.control?.broadcast({ t: 'connections', connections: this.opts.getConnections() });
  }

  /** Broadcast the current global settings to attached consoles. */
  broadcastSettings(): void {
    this.control?.broadcast({ t: 'settings', settings: this.opts.getSettings() });
  }

  // ---- provider wrapper -------------------------------------------------

  /**
   * Return a UIProvider that records + broadcasts every mutation and delegates
   * lifecycle/rendering to `inner`.
   */
  wrapProvider(inner: UIProvider): UIProvider {
    // Arrow properties keep `this` bound to the bridge (no this-aliasing).
    return {
      start: () => inner.start(),
      stop: () => inner.stop(),
      waitUntilExit: () => inner.waitUntilExit(),
      getToggles: () => inner.getToggles(),

      setReady: () => {
        this.ready = true;
        inner.setReady();
        this.control?.broadcast({ t: 'ready' });
      },
      setShuttingDown: () => {
        this.shuttingDown = true;
        inner.setShuttingDown();
        this.control?.broadcast({ t: 'shuttingDown' });
      },
      addSession: (session: SessionInfo) => {
        this.sessions.set(session.id, session);
        inner.addSession(session);
        this.control?.broadcast({ t: 'session:add', session });
      },
      updateSession: (sessionId: string, updates: Partial<SessionInfo>) => {
        const existing = this.sessions.get(sessionId);
        if (existing) this.sessions.set(sessionId, { ...existing, ...updates });
        inner.updateSession(sessionId, updates);
        this.control?.broadcast({ t: 'session:update', sessionId, updates });
      },
      removeSession: (sessionId: string) => {
        this.sessions.delete(sessionId);
        inner.removeSession(sessionId);
        this.control?.broadcast({ t: 'session:remove', sessionId });
      },
      addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => {
        const full: LogEntry = {
          ...entry,
          id: `${Date.now()}-${this.logCounter++}`,
          timestamp: new Date(),
        };
        this.logs.push(full);
        if (this.logs.length > LOG_SNAPSHOT_CAP) {
          this.logs.splice(0, this.logs.length - LOG_SNAPSHOT_CAP);
        }
        inner.addLog(entry);
        this.control?.broadcast({ t: 'log', entry: full });
      },
      setPlatformStatus: (platformId: string, status: Partial<PlatformStatus>) => {
        // Always carry `id`: the snapshot ships `platforms` as a values array
        // (map keys are dropped), and consoles re-key it by `id`. Without this
        // the console can't match a status to its connection → shows every
        // connection as offline/disabled even when it's live.
        const existing = this.platforms.get(platformId);
        this.platforms.set(platformId, {
          ...(existing ?? {}),
          ...status,
          id: platformId,
        } as PlatformStatus);
        inner.setPlatformStatus(platformId, status);
        this.control?.broadcast({ t: 'platform', platformId, status });
      },
      setUpdateState: (state: UpdatePanelState) => {
        this.update = state;
        inner.setUpdateState(state);
        this.control?.broadcast({ t: 'update', state });
      },
    };
  }
}
