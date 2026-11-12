/**
 * Console (client) mode entry point.
 *
 * Given a live {@link ControlClient}, render the Ink TUI as a *pure console*:
 * hydrate it from the server snapshot, stream live events into it, and forward
 * user toggles/actions back as commands. Quitting the console detaches only —
 * it never stops the server.
 */
import { startUI, type UIProvider, type AppConfig, type UISeedState } from '../ui/index.js';
import type { ToggleCallbacks, SessionActionCallbacks } from '../ui/types.js';
import type { PlatformInstanceConfig, EditableGlobalSettings } from '../config/index.js';
import type { ControlClient } from './client.js';
import type { ServerEvent } from './protocol.js';

export async function runConsoleClient(client: ControlClient): Promise<void> {
  const { snapshot } = client;

  // The console's footer/debug rendering reads process.env.DEBUG at mount, so
  // align it with the server's live debug toggle.
  process.env.DEBUG = snapshot.toggles.debugMode ? '1' : '';

  // Prefer the live toggle values over the (possibly stale) snapshot config.
  const config: AppConfig = {
    ...snapshot.config,
    permissionMode: snapshot.toggles.permissionMode,
    chromeEnabled: snapshot.toggles.chromeEnabled,
    keepAliveEnabled: snapshot.toggles.keepAliveEnabled,
  };

  const initialState: UISeedState = {
    sessions: snapshot.sessions,
    platforms: snapshot.platforms,
    logs: snapshot.logs,
    update: snapshot.update ?? undefined,
    ready: snapshot.ready,
  };

  // Last-known (redacted) connection list for the edit picker/form. Seeded from
  // the snapshot and refreshed on `connections` events.
  let connections: PlatformInstanceConfig[] = snapshot.connections ?? [];
  // Last-known global settings for the settings form; refreshed on `settings`.
  let settings: EditableGlobalSettings = snapshot.settings;

  // User actions in the console → commands over the socket.
  const toggleCallbacks: ToggleCallbacks = {
    onDebugToggle: (enabled) => client.send({ t: 'toggle:debug', enabled }),
    onPermissionsToggle: (mode) => client.send({ t: 'toggle:permissions', mode }),
    onChromeToggle: (enabled) => client.send({ t: 'toggle:chrome', enabled }),
    onKeepAliveToggle: (enabled) => client.send({ t: 'toggle:keepAlive', enabled }),
    onPlatformToggle: (platformId, enabled) =>
      client.send({ t: 'toggle:platform', platformId, enabled }),
    onForceUpdate: () => client.send({ t: 'forceUpdate' }),
  };

  // Management actions → commands over the socket.
  const actionCallbacks: SessionActionCallbacks = {
    onSessionCancel: (sessionId) => client.send({ t: 'session:cancel', sessionId }),
    onSessionInterrupt: (sessionId) => client.send({ t: 'session:interrupt', sessionId }),
    onServerStop: () => client.send({ t: 'server:stop' }),
    onConnectionSave: (config) =>
      client.send({ t: 'connection:save', config: config as PlatformInstanceConfig }),
    onConnectionRemove: (id) => client.send({ t: 'connection:remove', id }),
  };

  let resolveExit: () => void;
  const exited = new Promise<void>((r) => {
    resolveExit = r;
  });

  const detach = () => {
    // Detach from the server; do NOT stop it.
    client.close();
    ui.stop().finally(() => resolveExit());
  };

  const ui: UIProvider = await startUI({
    config,
    headless: false,
    mode: 'console',
    initialState,
    toggleCallbacks,
    actionCallbacks,
    getConnections: () => connections,
    getSettings: () => settings,
    onSettingsSave: (s) => client.send({ t: 'settings:save', settings: s as EditableGlobalSettings }),
    onLeave: detach,
    onStopServer: () => {
      // Tell the remote server to shut down, then detach this console.
      client.send({ t: 'server:stop' });
      detach();
    },
  });

  // Stream live server events into the local TUI.
  client.onEvent((ev: ServerEvent) => {
    switch (ev.t) {
      case 'ready':
        ui.setReady();
        break;
      case 'shuttingDown':
        ui.setShuttingDown();
        break;
      case 'session:add':
        ui.addSession(ev.session);
        break;
      case 'session:update':
        ui.updateSession(ev.sessionId, ev.updates);
        break;
      case 'session:remove':
        ui.removeSession(ev.sessionId);
        break;
      case 'log':
        ui.addLog({
          level: ev.entry.level,
          component: ev.entry.component,
          message: ev.entry.message,
          sessionId: ev.entry.sessionId,
        });
        break;
      case 'platform':
        ui.setPlatformStatus(ev.platformId, ev.status);
        break;
      case 'update':
        ui.setUpdateState(ev.state);
        break;
      case 'connections':
        connections = ev.connections;
        break;
      case 'settings':
        settings = ev.settings;
        break;
      // 'toggles' / 'connection:result' / 'hello' / 'snapshot' need no live
      // handling here (results surface as log lines).
    }
  });

  // Server went away (shutdown/restart) or connection dropped → close console.
  client.onClose((reason) => {
    ui.addLog({ level: 'warn', component: 'console', message: `Detached: ${reason}` });
    ui.setShuttingDown();
    // Brief grace so the message renders, then exit the console cleanly.
    setTimeout(() => {
      ui.stop().finally(() => resolveExit());
    }, 300);
  });

  // Wait for an explicit detach (onQuit) or the server going away (onClose).
  // We intentionally do NOT await ui.waitUntilExit(): InkProvider.stop() does
  // not unmount the Ink app, so that promise never resolves on quit. main()
  // process.exit()s once we return.
  await exited;
}
