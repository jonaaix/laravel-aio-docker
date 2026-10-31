/**
 * App — the claude-threads management hub (master/detail TUI).
 *
 * Layout (lazygit-style):
 * ┌ header: title · version · status · counts ─────────────────────────┐
 * ├ Connections (list) ┬ Detail of the focused list's cursor item ──────┤
 * ├ Sessions    (list) │  (connection fields · session info+logs · logs)│
 * ├────────────────────┴─── footer: contextual keys ───────────────────┤
 *
 * Focus cycles Connections → Sessions → Logs with Tab. The focused panel owns
 * the ↑/↓ cursor; actions (a/e/r/x/i/space) apply to the item under the cursor.
 * Rendering + navigation are new here; the state model (useAppState), toggles,
 * update modal and all callbacks are unchanged.
 */
import React from 'react';
import { Box, Text, useStdout, useInput } from 'ink';
import { Select } from '@inkjs/ui';
import { LogPanel } from './components/index.js';
import { RootLayout } from './layouts/index.js';
import { Spinner } from './components/Spinner.js';
import { OverlayModal } from './components/OverlayModal.js';
import { ConnectionForm } from './components/ConnectionForm.js';
import { SettingsForm } from './components/SettingsForm.js';
import type { PlatformInstanceConfig, EditableGlobalSettings } from '../config/index.js';
import { permissionModeDisplay, parseChannelIds, belongsToConnection } from '../config/index.js';
import { useAppState } from './hooks/useAppState.js';
import type { AppConfig, SessionInfo, LogEntry, PlatformStatus, ToggleState, ToggleCallbacks, SessionActionCallbacks, UpdatePanelState } from './types.js';
import type { UISeedState } from './providers/types.js';
import { nextPermissionMode } from '../config/permission-mode-cycle.js';

interface AppProps {
  config: AppConfig;
  onStateReady: (handlers: AppHandlers) => void;
  onResizeReady?: (handler: () => void) => void;
  /** Leave the console but keep the bot running. */
  onLeave?: () => void;
  /** Stop the bot entirely and exit. */
  onStopServer?: () => void;
  toggleCallbacks?: ToggleCallbacks;
  actionCallbacks?: SessionActionCallbacks;
  /** Current connections (secrets redacted) for the detail/edit form. */
  getConnections?: () => unknown[];
  /** Current editable global settings for the settings form. */
  getSettings?: () => unknown;
  /** Persist + apply edited global settings. */
  onSettingsSave?: (settings: unknown) => void;
  /** 'server' → quit stops the bot; 'console' → quit just detaches. */
  mode?: 'server' | 'console';
  /** Seed state for console (client) mode — hydrates the TUI on attach. */
  initialState?: UISeedState;
}

export interface AppHandlers {
  setReady: () => void;
  setShuttingDown: () => void;
  addSession: (session: SessionInfo) => void;
  updateSession: (sessionId: string, updates: Partial<SessionInfo>) => void;
  removeSession: (sessionId: string) => void;
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  setPlatformStatus: (platformId: string, status: Partial<PlatformStatus>) => void;
  setUpdateState: (state: UpdatePanelState) => void;
  getToggles: () => ToggleState;
}

type Focus = 'connections' | 'sessions' | 'logs';
const FOCUS_ORDER: Focus[] = ['connections', 'sessions', 'logs'];

/** Normalized connection row (config joined with aggregated client status). */
interface ConnView {
  id: string;
  type: string;
  displayName: string;
  cfg?: PlatformInstanceConfig;
  /** Aggregated status across all of the connection's channel clients. */
  status?: PlatformStatus;
  channels: string[];
  /** How many of the connection's channel clients are currently connected. */
  connectedChannels: number;
  sessionCount: number;
}

export function App({ config, onStateReady, onResizeReady, onLeave, onStopServer, toggleCallbacks, actionCallbacks, getConnections, getSettings, onSettingsSave, mode = 'server', initialState }: AppProps) {
  const {
    state,
    setReady,
    setShuttingDown,
    addSession,
    updateSession,
    removeSession,
    addLog,
    selectSession,
    setPlatformStatus,
    togglePlatformEnabled,
    getLogsForSession,
    getGlobalLogs,
  } = useAppState(config, initialState);

  const { stdout } = useStdout();
  const terminalCols = stdout?.columns ?? 100;
  const leftWidth = Math.min(60, Math.max(34, Math.floor(terminalCols * 0.42)));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [resizeCount, setResizeCount] = React.useState(0);

  const [toggles, setToggles] = React.useState<ToggleState>({
    debugMode: process.env.DEBUG === '1',
    permissionMode: config.permissionMode,
    chromeEnabled: config.chromeEnabled,
    keepAliveEnabled: config.keepAliveEnabled,
    updateModalVisible: false,
    logsFocused: false,
  });

  const [updateState, setUpdateStateVal] = React.useState<UpdatePanelState>(
    initialState?.update ?? { status: 'idle', currentVersion: config.version },
  );

  const [activeModal, setActiveModal] = React.useState<React.ReactNode | null>(null);
  const [pendingConfirm, setPendingConfirm] = React.useState<{ message: string; run: () => void } | null>(null);
  const [formOpen, setFormOpen] = React.useState<{ initial?: PlatformInstanceConfig } | null>(null);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [quitMenu, setQuitMenu] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Hub navigation state.
  const [focus, setFocus] = React.useState<Focus>('connections');
  const [connCursor, setConnCursor] = React.useState(0);
  const [sessCursor, setSessCursor] = React.useState(0);

  // ---- toggle handlers (unchanged behavior) ----
  const handleDebugToggle = React.useCallback(() => {
    setToggles((prev) => {
      const v = !prev.debugMode;
      process.env.DEBUG = v ? '1' : '';
      toggleCallbacks?.onDebugToggle?.(v);
      return { ...prev, debugMode: v };
    });
  }, [toggleCallbacks]);
  const handlePermissionsToggle = React.useCallback(() => {
    setToggles((prev) => {
      const m = nextPermissionMode(prev.permissionMode);
      toggleCallbacks?.onPermissionsToggle?.(m);
      return { ...prev, permissionMode: m };
    });
  }, [toggleCallbacks]);
  const handleChromeToggle = React.useCallback(() => {
    setToggles((prev) => {
      const v = !prev.chromeEnabled;
      toggleCallbacks?.onChromeToggle?.(v);
      return { ...prev, chromeEnabled: v };
    });
  }, [toggleCallbacks]);
  const handleKeepAliveToggle = React.useCallback(() => {
    setToggles((prev) => {
      const v = !prev.keepAliveEnabled;
      toggleCallbacks?.onKeepAliveToggle?.(v);
      return { ...prev, keepAliveEnabled: v };
    });
  }, [toggleCallbacks]);
  const handleUpdateModalToggle = React.useCallback(() => {
    setToggles((prev) => {
      const visible = !prev.updateModalVisible;
      setActiveModal(
        visible ? (
          <OverlayModal title="Update Status" hint={getUpdateHint(updateState)}>
            <UpdateModalContent state={updateState} />
          </OverlayModal>
        ) : null,
      );
      return { ...prev, updateModalVisible: visible };
    });
  }, [updateState]);

  const getToggles = React.useCallback(() => toggles, [toggles]);

  // Expose handlers to the provider (setUpdateState also refreshes the modal).
  const setUpdateState = React.useCallback((s: UpdatePanelState) => setUpdateStateVal(s), []);
  React.useEffect(() => {
    onStateReady({
      setReady,
      setShuttingDown,
      addSession,
      updateSession,
      removeSession,
      addLog,
      setPlatformStatus,
      setUpdateState,
      getToggles,
    });
  }, [onStateReady, setReady, setShuttingDown, addSession, updateSession, removeSession, addLog, setPlatformStatus, setUpdateState, getToggles]);

  React.useEffect(() => {
    if (onResizeReady) onResizeReady(() => setResizeCount((c) => c + 1));
  }, [onResizeReady]);

  React.useEffect(() => {
    if (toggles.updateModalVisible) {
      setActiveModal(
        <OverlayModal title="Update Status" hint={getUpdateHint(updateState)}>
          <UpdateModalContent state={updateState} />
        </OverlayModal>,
      );
    }
  }, [updateState, toggles.updateModalVisible]);

  // ---- derive rows ----
  const sessions = React.useMemo(() => Array.from(state.sessions.values()), [state.sessions]);
  const connViews = React.useMemo<ConnView[]>(() => {
    const configs = (getConnections?.() ?? []) as PlatformInstanceConfig[];
    const platformArr = Array.from(state.platforms.values());
    // Sessions whose platform (the part before ':') belongs to a connection.
    const countFor = (baseId: string) =>
      sessions.filter((s) => belongsToConnection(s.id.split(':')[0], baseId)).length;
    // Merge the statuses of a connection's channel clients into one.
    const aggregate = (baseId: string): PlatformStatus | undefined => {
      const subs = platformArr.filter((p) => p.id && belongsToConnection(p.id, baseId));
      if (subs.length === 0) return undefined;
      return {
        ...subs[0],
        id: baseId,
        connected: subs.every((s) => s.connected),
        reconnecting: subs.some((s) => s.reconnecting),
        enabled: subs.some((s) => s.enabled),
      };
    };
    const connectedCount = (baseId: string) =>
      platformArr.filter((p) => p.id && belongsToConnection(p.id, baseId) && p.connected).length;
    if (configs.length > 0) {
      return configs.map((cfg) => {
        const channels = parseChannelIds((cfg as { channelId?: unknown }).channelId);
        return {
          id: cfg.id,
          type: cfg.type,
          displayName: cfg.displayName || cfg.id,
          cfg,
          status: aggregate(cfg.id),
          channels,
          connectedChannels: connectedCount(cfg.id),
          sessionCount: countFor(cfg.id),
        };
      });
    }
    // Fallback: derive from live platform status when configs aren't available.
    return platformArr.map((p) => ({
      id: p.id,
      type: p.platformType ?? 'platform',
      displayName: p.displayName || p.id,
      status: p,
      channels: [],
      connectedChannels: p.connected ? 1 : 0,
      sessionCount: countFor(p.id),
    }));
  }, [getConnections, state.platforms, sessions]);

  // Clamp cursors to current list bounds.
  const connIdx = connViews.length ? Math.min(connCursor, connViews.length - 1) : 0;
  const sessIdx = sessions.length ? Math.min(sessCursor, sessions.length - 1) : 0;
  const selectedConn = connViews[connIdx];
  const selectedSession = sessions[sessIdx];

  // ---- actions ----
  const openAdd = React.useCallback(() => setFormOpen({}), []);
  const editSelected = React.useCallback(() => {
    if (selectedConn?.cfg) setFormOpen({ initial: selectedConn.cfg });
  }, [selectedConn]);
  const removeSelected = React.useCallback(() => {
    if (!selectedConn) return;
    setPendingConfirm({
      message: `Remove connection "${selectedConn.id}"?`,
      run: () => actionCallbacks?.onConnectionRemove?.(selectedConn.id),
    });
  }, [selectedConn, actionCallbacks]);
  const toggleSelectedConn = React.useCallback(() => {
    if (!selectedConn) return;
    const newEnabled = togglePlatformEnabled(selectedConn.id);
    toggleCallbacks?.onPlatformToggle?.(selectedConn.id, newEnabled);
  }, [selectedConn, togglePlatformEnabled, toggleCallbacks]);
  const stopSelectedSession = React.useCallback(() => {
    if (!selectedSession) return;
    const label = selectedSession.title || selectedSession.displayName || selectedSession.threadId;
    setPendingConfirm({
      message: `Stop session "${label}"?`,
      run: () => actionCallbacks?.onSessionCancel?.(selectedSession.id),
    });
  }, [selectedSession, actionCallbacks]);
  const interruptSelectedSession = React.useCallback(() => {
    if (selectedSession) actionCallbacks?.onSessionInterrupt?.(selectedSession.id);
  }, [selectedSession, actionCallbacks]);
  const submitConnection = React.useCallback(
    (cfg: PlatformInstanceConfig) => {
      actionCallbacks?.onConnectionSave?.(cfg);
      setFormOpen(null);
    },
    [actionCallbacks],
  );

  const canManageConns = !!actionCallbacks?.onConnectionSave;
  const logsFocused = focus === 'logs';
  const anyModal = formOpen !== null || pendingConfirm !== null || helpOpen || quitMenu || settingsOpen || toggles.updateModalVisible;

  // Esc closes the quit menu (the Select itself ignores Esc).
  useInput(
    (_input, key) => {
      if (key.escape) setQuitMenu(false);
    },
    { isActive: quitMenu },
  );

  // ---- keyboard ----
  useInput(
    (input, key) => {
      // Confirm dialog owns the keyboard.
      if (pendingConfirm) {
        if (input.toLowerCase() === 'y') setPendingConfirm((p) => { p?.run(); return null; });
        else if (input.toLowerCase() === 'n' || key.escape) setPendingConfirm(null);
        return;
      }
      if (helpOpen) {
        if (key.escape || input === '?' || input.toLowerCase() === 'q') setHelpOpen(false);
        return;
      }
      if (toggles.updateModalVisible) {
        if (input === 'U') toggleCallbacks?.onForceUpdate?.();
        else if (input.toLowerCase() === 'u' || key.escape) handleUpdateModalToggle();
        return;
      }

      // Ctrl+C is the immediate escape hatch: stop the bot in server mode,
      // detach in console mode.
      if (input === '\x03' || (input === 'c' && key.ctrl)) {
        if (mode === 'server') onStopServer?.();
        else onLeave?.();
        return;
      }
      // q opens the quit menu (leave-and-keep-running vs stop-server) — the
      // same choice in both modes.
      if (input === 'q') { setQuitMenu(true); return; }
      if (input === '?') { setHelpOpen(true); return; }
      if (input === 'g' && getSettings && onSettingsSave) { setSettingsOpen(true); return; }

      // Focus movement.
      if (key.tab) {
        const dir = key.shift ? -1 : 1;
        setFocus((f) => FOCUS_ORDER[(FOCUS_ORDER.indexOf(f) + dir + FOCUS_ORDER.length) % FOCUS_ORDER.length]);
        return;
      }

      // Cursor movement (logs panel scrolls itself via LogPanel).
      if (focus !== 'logs' && (key.upArrow || key.downArrow)) {
        const delta = key.upArrow ? -1 : 1;
        if (focus === 'connections' && connViews.length) {
          setConnCursor((c) => (Math.min(c, connViews.length - 1) + delta + connViews.length) % connViews.length);
        } else if (focus === 'sessions' && sessions.length) {
          setSessCursor((c) => {
            const next = (Math.min(c, sessions.length - 1) + delta + sessions.length) % sessions.length;
            const s = sessions[next];
            if (s) selectSession(s.id);
            return next;
          });
        }
        return;
      }

      // Number keys jump to a session.
      const num = parseInt(input, 10);
      if (num >= 1 && num <= 9 && sessions[num - 1]) {
        setFocus('sessions');
        setSessCursor(num - 1);
        selectSession(sessions[num - 1].id);
        return;
      }

      // Context actions.
      if (focus === 'connections') {
        if (input === 'a' && canManageConns) { openAdd(); return; }
        if (input === 'e' && canManageConns) { editSelected(); return; }
        if (input === 'r' && actionCallbacks?.onConnectionRemove) { removeSelected(); return; }
        if (input === ' ') { toggleSelectedConn(); return; }
        if (key.return && canManageConns) { editSelected(); return; }
      }
      if (focus === 'sessions') {
        if (input === 'x' && actionCallbacks?.onSessionCancel) { stopSelectedSession(); return; }
        if (input === 'i' && actionCallbacks?.onSessionInterrupt) { interruptSelectedSession(); return; }
      }
      // 'a' also adds from anywhere for convenience.
      if (input === 'a' && canManageConns) { openAdd(); return; }

      // Global toggles + actions.
      switch (input) {
        case 'd': handleDebugToggle(); break;
        case 'p': handlePermissionsToggle(); break;
        case 'c': handleChromeToggle(); break;
        case 'k': handleKeepAliveToggle(); break;
        case 'u': handleUpdateModalToggle(); break;
        case 'U': toggleCallbacks?.onForceUpdate?.(); break;
        case 'X':
          if (actionCallbacks?.onServerStop) {
            setPendingConfirm({
              message: 'Stop the entire server? All active sessions will end.',
              run: () => actionCallbacks?.onServerStop?.(),
            });
          }
          break;
      }
    },
    { isActive: formOpen === null && !quitMenu && !settingsOpen },
  );

  // ---- render pieces ----
  const globalLogs = getGlobalLogs();
  const connected = connViews.filter((c) => c.status?.connected).length;
  const activeSessions = sessions.filter((s) => s.status === 'active' || s.status === 'starting').length;

  const header = (
    <HubHeader
      version={config.version}
      claudeVersion={config.claudeVersion}
      workingDir={config.workingDir}
      ready={state.ready}
      shuttingDown={state.shuttingDown}
      connConnected={connected}
      connTotal={connViews.length}
      activeSessions={activeSessions}
      toggles={toggles}
      updateState={updateState}
      mode={mode}
    />
  );

  const footer = <HubFooter focus={focus} canManageConns={canManageConns} />;

  const body = (
    <Box flexDirection="row" flexGrow={1} overflow="hidden">
      {/* Left column: two stacked lists */}
      <Box flexDirection="column" width={leftWidth} flexShrink={0}>
        <ListPanel title="Connections" count={connViews.length} focused={focus === 'connections'}>
          {connViews.length === 0 ? (
            <EmptyHint lines={canManageConns ? ['No connections', 'Press [a] to add'] : ['No connections']} />
          ) : (
            connViews.map((c, i) => (
              <ConnRow key={c.id} conn={c} active={i === connIdx && focus === 'connections'} />
            ))
          )}
        </ListPanel>
        <ListPanel title="Sessions" count={sessions.length} focused={focus === 'sessions'}>
          {sessions.length === 0 ? (
            <EmptyHint lines={['No active sessions', '@mention the bot in chat']} />
          ) : (
            sessions.map((s, i) => (
              <SessRow key={s.id} index={i + 1} session={s} active={i === sessIdx && focus === 'sessions'} />
            ))
          )}
        </ListPanel>
      </Box>

      {/* Right: detail of the focused list's cursor item */}
      <Box flexGrow={1} flexDirection="column" borderStyle="round" borderColor={logsFocused ? 'cyan' : 'gray'} paddingX={1} overflow="hidden">
        <DetailPane
          focus={focus}
          conn={selectedConn}
          session={selectedSession}
          sessionLogs={selectedSession ? getLogsForSession(selectedSession.id) : []}
          globalLogs={globalLogs}
          logsFocused={logsFocused && !anyModal}
        />
      </Box>
    </Box>
  );

  // Modal precedence: form > confirm > help > update.
  const formModal = formOpen ? (
    <ConnectionForm
      initial={formOpen.initial}
      existingIds={connViews.map((c) => c.id)}
      onSubmit={submitConnection}
      onCancel={() => setFormOpen(null)}
    />
  ) : null;
  const confirmModal = pendingConfirm ? (
    <OverlayModal title="Confirm" hint="[y] yes   [n] or [Esc] cancel">
      <Box justifyContent="center"><Text>{pendingConfirm.message}</Text></Box>
    </OverlayModal>
  ) : null;
  const helpModal = helpOpen ? <HelpModal /> : null;
  const quitModal = quitMenu ? (
    <OverlayModal title="Quit" width={52} hint="↑/↓ select · Enter · [Esc] cancel">
      <Select
        options={[
          { label: 'Leave console — keep server running', value: 'leave' },
          { label: 'Quit server (stop everything)', value: 'stop' },
        ]}
        onChange={(v) => {
          setQuitMenu(false);
          if (v === 'leave') onLeave?.();
          else onStopServer?.();
        }}
      />
    </OverlayModal>
  ) : null;

  const settingsModal =
    settingsOpen && getSettings ? (
      <SettingsForm
        initial={getSettings() as EditableGlobalSettings}
        onSubmit={(s) => {
          onSettingsSave?.(s);
          setSettingsOpen(false);
        }}
        onCancel={() => setSettingsOpen(false)}
      />
    ) : null;

  return (
    <RootLayout header={header} footer={footer} modal={formModal ?? confirmModal ?? helpModal ?? quitModal ?? settingsModal ?? activeModal}>
      {body}
    </RootLayout>
  );
}

// ---------------------------------------------------------------------------
// Presentational components
// ---------------------------------------------------------------------------

function HubHeader({
  version, claudeVersion, workingDir, ready, shuttingDown, connConnected, connTotal, activeSessions, toggles, updateState, mode,
}: {
  version: string; claudeVersion: string; workingDir: string; ready: boolean; shuttingDown: boolean;
  connConnected: number; connTotal: number; activeSessions: number; toggles: ToggleState; updateState: UpdatePanelState;
  mode: 'server' | 'console';
}) {
  const status = shuttingDown
    ? <Box gap={1}><Spinner type="line" /><Text color="yellow">Shutting down…</Text></Box>
    : ready
      ? <Box gap={1}><Text color="green">●</Text><Text dimColor>Ready</Text></Box>
      : <Box gap={1}><Spinner type="dots" /><Text dimColor>Starting…</Text></Box>;
  const perms = permissionModeDisplay(toggles.permissionMode);
  const { stdout } = useStdout();
  const rule = '─'.repeat(Math.max(0, (stdout?.columns ?? 100) - 2));
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box>
        <Text bold color="cyan">claude-threads</Text>
        <Text dimColor>  management hub</Text>
        <Text color={mode === 'console' ? 'magenta' : 'blue'}>  {mode === 'console' ? '⇄ console' : '⌂ server'}</Text>
        <Box flexGrow={1} justifyContent="flex-end">{status}</Box>
      </Box>
      <Box>
        <Text dimColor>v{version} · claude {claudeVersion}</Text>
        <Text dimColor>  ·  conns {connConnected}/{connTotal}  ·  sessions {activeSessions} active</Text>
        <Box flexGrow={1} justifyContent="flex-end">
          <Text dimColor>perms:{perms.label.toLowerCase()}</Text>
          {updateState.status === 'available' && <Text color="green">  ⬆ update</Text>}
        </Box>
      </Box>
      <Text dimColor wrap="truncate-end">{'  ' + workingDir}</Text>
      <Text dimColor wrap="truncate-end">{rule}</Text>
    </Box>
  );
}

function ListPanel({ title, count, focused, children }: { title: string; count: number; focused: boolean; children: React.ReactNode }) {
  return (
    <Box flexDirection="column" flexGrow={1} borderStyle="round" borderColor={focused ? 'cyan' : 'gray'} paddingX={1} overflow="hidden">
      <Box>
        <Text bold color={focused ? 'cyan' : 'gray'}>{title}</Text>
        <Text dimColor> ({count})</Text>
        {focused && <Box flexGrow={1} justifyContent="flex-end"><Text color="cyan">◂</Text></Box>}
      </Box>
      <Box flexDirection="column" overflow="hidden">{children}</Box>
    </Box>
  );
}

function EmptyHint({ lines }: { lines: string[] }) {
  return (
    <Box flexDirection="column" paddingTop={1}>
      {lines.map((l, i) => <Text key={i} dimColor italic={i === 0}>  {l}</Text>)}
    </Box>
  );
}

function connDotColor(status?: PlatformStatus): string {
  if (!status || !status.enabled) return 'gray';
  if (status.reconnecting) return 'yellow';
  if (status.connected) return 'green';
  return 'red';
}

/**
 * A row is a two-line block: name on top, platform (+ session count) dimmed
 * underneath. Fixed-width slots for the cursor marker and status dot keep every
 * row's name column aligned even when a terminal renders those glyphs (❯, ●)
 * as two cells — their display width is ambiguous, so we never rely on it.
 */
function ConnRow({ conn, active }: { conn: ConnView; active: boolean }) {
  const chans = conn.channels.length > 1 ? ` · ${conn.channels.length}ch` : '';
  const meta = `${conn.type}${chans}${conn.sessionCount > 0 ? ` · ${conn.sessionCount} active` : ''}`;
  return (
    <Box flexDirection="column">
      <Box>
        <Box width={2} flexShrink={0}><Text color="cyan">{active ? '❯' : ''}</Text></Box>
        <Box width={2} flexShrink={0}><Text color={connDotColor(conn.status)}>●</Text></Box>
        <Text color={active ? 'cyan' : undefined} bold={active} wrap="truncate-end">{conn.displayName}</Text>
      </Box>
      <Box>
        <Box width={4} flexShrink={0}><Text> </Text></Box>
        <Text dimColor>{meta}</Text>
      </Box>
    </Box>
  );
}

function sessStatusColor(s: SessionInfo['status']): string {
  switch (s) {
    case 'active': return 'green';
    case 'starting': return 'cyan';
    case 'paused': return 'yellow';
    case 'stopping': return 'red';
    default: return 'gray';
  }
}

function SessRow({ index, session, active }: { index: number; session: SessionInfo; active: boolean }) {
  const label = session.title || session.displayName || session.threadId;
  const meta = `@${session.startedBy}${session.platformDisplayName ? ` · ${session.platformDisplayName}` : ''}`;
  return (
    <Box flexDirection="column">
      <Box>
        <Box width={2} flexShrink={0}><Text color="cyan">{active ? '❯' : ''}</Text></Box>
        <Box width={2} flexShrink={0}><Text color={sessStatusColor(session.status)}>{session.isTyping ? '◐' : '●'}</Text></Box>
        <Text dimColor>{index} </Text>
        <Text color={active ? 'cyan' : undefined} bold={active} wrap="truncate-end">{label}</Text>
      </Box>
      <Box>
        <Box width={4} flexShrink={0}><Text> </Text></Box>
        <Text dimColor>{meta}</Text>
      </Box>
    </Box>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Box width={12}><Text dimColor>{label}</Text></Box>
      <Box flexGrow={1}>{typeof value === 'string' ? <Text wrap="truncate-end">{value}</Text> : value}</Box>
    </Box>
  );
}

function DetailPane({
  focus, conn, session, sessionLogs, globalLogs, logsFocused,
}: {
  focus: Focus;
  conn?: ConnView;
  session?: SessionInfo;
  sessionLogs: LogEntry[];
  globalLogs: LogEntry[];
  logsFocused: boolean;
}) {
  if (focus === 'logs') {
    return (
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        <Text bold color="cyan">Logs</Text>
        {globalLogs.length > 0
          ? <LogPanel logs={globalLogs} focused={logsFocused} />
          : <Text dimColor italic>  No logs yet</Text>}
      </Box>
    );
  }

  if (focus === 'connections') {
    if (!conn) return <CenteredHint text="No connection selected" />;
    const c = (conn.cfg ?? {}) as unknown as {
      botName?: string; channelId?: string; allowedUsers?: string[]; permissionMode?: string;
      agent?: string; model?: unknown; description?: unknown; workingDir?: unknown; url?: string;
    };
    const st = conn.status;
    const statusText = !st || !st.enabled ? 'disabled'
      : st.reconnecting ? 'reconnecting'
      : st.connected ? 'connected' : 'offline';
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">{conn.displayName}</Text>
        <Text dimColor>{conn.type}{conn.id !== conn.displayName && conn.id !== conn.type ? ` · ${conn.id}` : ''}</Text>
        <Box marginTop={1} flexDirection="column">
          <Field label="Status" value={<Text color={connDotColor(st)}>{statusText}</Text>} />
          {c.url && <Field label="Server" value={c.url} />}
          <Field label="Bot" value={c.botName ? `@${c.botName}` : '—'} />
          <Field
            label={conn.channels.length > 1 ? 'Channels' : 'Channel'}
            value={conn.channels.length ? conn.channels.join(', ') : (c.channelId ?? '—')}
          />
          {conn.channels.length > 1 && <Field label="Live" value={`${conn.connectedChannels}/${conn.channels.length} connected`} />}
          <Field label="Users" value={c.allowedUsers?.length ? c.allowedUsers.join(', ') : 'anyone ⚠'} />
          <Field label="Perms" value={c.permissionMode ?? '—'} />
          <Field label="Agent" value={typeof c.agent === 'string' ? c.agent : 'claude'} />
          {typeof c.model === 'string' && c.model && <Field label="Model" value={c.model} />}
          {typeof c.workingDir === 'string' && c.workingDir && <Field label="Dir" value={c.workingDir} />}
          {typeof c.description === 'string' && c.description && <Field label="Role" value={c.description} />}
          <Field label="Sessions" value={`${conn.sessionCount} active`} />
        </Box>
        <Box marginTop={1}><Text dimColor italic>a add · e edit · r remove · space enable/disable</Text></Box>
      </Box>
    );
  }

  // focus === 'sessions'
  if (!session) return <CenteredHint text="No session selected" />;
  const logs = sessionLogs.slice(-14);
  return (
    <Box flexDirection="column" flexGrow={1} overflow="hidden">
      <Text bold color="cyan" wrap="truncate-end">{session.title || session.displayName || session.threadId}</Text>
      <Box>
        <Text dimColor>@{session.startedBy}</Text>
        <Text dimColor> · {session.platformDisplayName || session.platformType || ''}</Text>
        <Text color={sessStatusColor(session.status)}> · {session.status}</Text>
        {session.worktreeBranch && <Text dimColor> · {session.worktreeBranch}</Text>}
      </Box>
      <Text dimColor wrap="truncate-end">{'  ' + session.workingDir}</Text>
      <Text dimColor>{'─'.repeat(80)}</Text>
      <Box flexDirection="column" flexGrow={1} overflow="hidden">
        {logs.length === 0
          ? <Text dimColor italic>  (no output yet)</Text>
          : logs.map((l) => (
              <Box key={l.id}>
                <Text dimColor>[{l.component}]</Text>
                <Text color={l.level === 'error' ? 'red' : l.level === 'warn' ? 'yellow' : 'white'}> {l.message}</Text>
              </Box>
            ))}
      </Box>
      <Box marginTop={1}><Text dimColor italic>x stop · i interrupt</Text></Box>
    </Box>
  );
}

function CenteredHint({ text }: { text: string }) {
  return (
    <Box flexGrow={1} alignItems="center" justifyContent="center">
      <Text dimColor italic>{text}</Text>
    </Box>
  );
}

function HubFooter({ focus, canManageConns }: { focus: Focus; canManageConns: boolean }) {
  const ctx = focus === 'connections'
    ? (canManageConns ? 'a add · e edit · r rm · space toggle' : 'space toggle')
    : focus === 'sessions'
      ? 'x stop · i interrupt · 1-9 jump'
      : '↑/↓ scroll · g/G top/bottom';
  const { stdout } = useStdout();
  const rule = '─'.repeat(Math.max(0, (stdout?.columns ?? 100) - 2));
  return (
    <Box flexDirection="column">
      <Text dimColor wrap="truncate-end">{rule}</Text>
      <Box paddingX={1} gap={2}>
        <Text><Text color="cyan">tab</Text><Text dimColor> panel</Text></Text>
        <Text><Text color="cyan">↑/↓</Text><Text dimColor> move</Text></Text>
        <Text dimColor wrap="truncate-end">{ctx}</Text>
        <Box flexGrow={1} justifyContent="flex-end">
          <Text dimColor wrap="truncate-end">g settings · d/p/c/k · ⇧X stop · ? help · q quit</Text>
        </Box>
      </Box>
    </Box>
  );
}

function HelpModal() {
  const rows: [string, string][] = [
    ['tab / shift-tab', 'switch panel (Connections / Sessions / Logs)'],
    ['↑ / ↓', 'move cursor (scroll in Logs)'],
    ['1–9', 'jump to session'],
    ['a / e / r', 'add / edit / remove connection'],
    ['space', 'enable / disable connection'],
    ['x / i', 'stop / interrupt session'],
    ['d / p / c / k', 'toggle debug / perms / chrome / keep-alive'],
    ['u / ⇧U', 'update panel / force update'],
    ['⇧X', 'stop the whole server'],
    ['g', 'edit global settings'],
    ['? / q', 'this help / quit'],
  ];
  return (
    <OverlayModal title="Keyboard" width={64} hint="[?] or [Esc] to close">
      <Box flexDirection="column">
        {rows.map(([k, v]) => (
          <Box key={k}>
            <Box width={18}><Text color="cyan">{k}</Text></Box>
            <Text dimColor>{v}</Text>
          </Box>
        ))}
      </Box>
    </OverlayModal>
  );
}

// ---------------------------------------------------------------------------
// Update modal helpers (unchanged)
// ---------------------------------------------------------------------------

function getUpdateHint(state: UpdatePanelState): string {
  const canUpdate = state.status === 'available' || state.status === 'deferred';
  return canUpdate
    ? 'Press [Shift+U] to update now  |  [u] or [Esc] to close'
    : 'Press [u] or [Esc] to close';
}

function UpdateModalContent({ state }: { state: UpdatePanelState }) {
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" gap={0}>
        <Box><Text dimColor>Current version: </Text><Text bold>v{state.currentVersion}</Text></Box>
        {state.latestVersion && state.latestVersion !== state.currentVersion && (
          <Box><Text dimColor>Latest version:  </Text><Text bold color="green">v{state.latestVersion}</Text></Box>
        )}
      </Box>
      <Box marginTop={1}><StatusIcon state={state} /></Box>
      {state.status === 'scheduled' && state.scheduledRestartAt && (
        <Box marginTop={1}><Text dimColor>Restart at: </Text><Text>{formatTime(state.scheduledRestartAt)}</Text></Box>
      )}
      {state.status === 'deferred' && state.deferredUntil && (
        <Box marginTop={1}><Text dimColor>Deferred until: </Text><Text>{formatTime(state.deferredUntil)}</Text></Box>
      )}
      {state.status === 'failed' && state.errorMessage && (
        <Box marginTop={1} flexDirection="column"><Text color="red">Error:</Text><Text dimColor>{state.errorMessage}</Text></Box>
      )}
    </Box>
  );
}

function StatusIcon({ state }: { state: UpdatePanelState }) {
  const { icon, label, color } = getStatusDisplay(state);
  if (state.status === 'installing') return <Box gap={1}><Text color={color}>{label}</Text></Box>;
  return <Box gap={1}><Text>{icon}</Text><Text color={color}>{label}</Text></Box>;
}

function getStatusDisplay(state: UpdatePanelState): { icon: string; label: string; color: string } {
  switch (state.status) {
    case 'idle': return { icon: '✓', label: 'Up to date', color: 'green' };
    case 'available': return { icon: '🆕', label: 'Update available', color: 'green' };
    case 'scheduled': return { icon: '⏰', label: 'Restart scheduled', color: 'yellow' };
    case 'installing': return { icon: '📦', label: 'Installing...', color: 'cyan' };
    case 'pending_restart': return { icon: '🔄', label: 'Restarting...', color: 'yellow' };
    case 'failed': return { icon: '❌', label: 'Update failed', color: 'red' };
    case 'deferred': return { icon: '⏸️', label: 'Update deferred', color: 'gray' };
    default: return { icon: '?', label: 'Unknown', color: 'gray' };
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
