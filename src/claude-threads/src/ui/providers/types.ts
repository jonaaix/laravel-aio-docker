/**
 * UI Provider types - abstraction layer for different UI implementations
 *
 * This allows the bot to run with:
 * - InkProvider: Full TUI with Ink (default)
 * - HeadlessProvider: Console-only mode (logs to stdout)
 */

import type {
  SessionInfo,
  LogEntry,
  PlatformStatus,
  UpdatePanelState,
  ToggleState,
  ToggleCallbacks,
  SessionActionCallbacks,
  AppConfig,
} from '../types.js';

/**
 * Pre-populated UI state. Used by the management console (client mode) to
 * hydrate the TUI from a server snapshot on attach — so sessions, platforms,
 * logs (with their original timestamps) and update state render immediately,
 * before any live events arrive.
 */
export interface UISeedState {
  sessions: SessionInfo[];
  platforms: PlatformStatus[];
  logs: LogEntry[];
  update?: UpdatePanelState;
  ready: boolean;
}

/**
 * Core UI operations that all providers must implement
 */
export interface UIOperations {
  /** Mark the UI as ready (startup complete) */
  setReady(): void;

  /** Mark the UI as shutting down */
  setShuttingDown(): void;

  /** Add a new session to the UI */
  addSession(session: SessionInfo): void;

  /** Update an existing session */
  updateSession(sessionId: string, updates: Partial<SessionInfo>): void;

  /** Remove a session from the UI */
  removeSession(sessionId: string): void;

  /** Add a log entry */
  addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): void;

  /** Update platform status */
  setPlatformStatus(platformId: string, status: Partial<PlatformStatus>): void;

  /** Update auto-update state */
  setUpdateState(state: UpdatePanelState): void;

  /** Get current toggle state */
  getToggles(): ToggleState;
}

/**
 * UI Provider interface - implemented by both Ink and Headless providers
 */
export interface UIProvider extends UIOperations {
  /** Start the UI (renders in Ink mode, initializes in headless mode) */
  start(): Promise<void>;

  /** Stop the UI and cleanup resources */
  stop(): Promise<void>;

  /** Wait for the UI to exit (used for graceful shutdown) */
  waitUntilExit(): Promise<void>;
}

/**
 * Options for starting the UI
 */
export interface StartUIOptions {
  /** App configuration */
  config: AppConfig;

  /** Run in headless mode (no interactive UI) */
  headless?: boolean;

  /**
   * Whether this UI drives the server itself ('server' — quitting stops the
   * bot) or is a console attached to a separate server ('console' — quitting
   * just detaches). Governs the quit label + confirm. Defaults to 'server'.
   */
  mode?: 'server' | 'console';

  /**
   * Leave the console but keep the bot running. In console mode this just
   * detaches the socket; in server (foreground) mode it re-launches the server
   * detached in the background and exits this process.
   */
  onLeave?: () => void;

  /** Stop the bot entirely (ends all sessions) and exit. */
  onStopServer?: () => void;

  /** Callbacks for toggle changes */
  toggleCallbacks?: ToggleCallbacks;

  /** Callbacks for management actions (stop/interrupt session, stop server). */
  actionCallbacks?: SessionActionCallbacks;

  /**
   * Current connections (secrets redacted) for the edit form. Returns the live
   * list on the server; the last-known list in console mode.
   */
  getConnections?: () => unknown[];

  /** Current editable global settings (server: live; console: last-known). */
  getSettings?: () => unknown;
  /** Persist + apply edited global settings. */
  onSettingsSave?: (settings: unknown) => void;

  /** Seed state for console (client) mode — hydrates the TUI on attach. */
  initialState?: UISeedState;
}
