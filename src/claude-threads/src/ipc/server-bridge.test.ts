import { describe, test, expect, afterEach } from 'bun:test';
import { tmpdir } from 'os';
import { join } from 'path';
import { ServerBridge } from './server-bridge.js';
import { ControlClient } from './client.js';
import type { AppConfig } from '../ui/types.js';
import type { ServerEvent } from './protocol.js';

const config: AppConfig = {
  version: '9.9.9',
  workingDir: '/tmp/x',
  claudeVersion: '2.1.0',
  claudeCompatible: true,
  permissionMode: 'auto',
  chromeEnabled: false,
  keepAliveEnabled: true,
};

let uniq = 0;
function tmpSocket(): string {
  return join(tmpdir(), `ct-bridge-${process.pid}-${uniq++}.sock`);
}

const bridges: ServerBridge[] = [];
afterEach(async () => {
  while (bridges.length) await bridges.pop()!.close();
});

interface Spies {
  cancelled: string[];
  interrupted: string[];
  stopped: number;
  debug: boolean[];
  perms: string[];
}

async function makeBridge(socketPath: string): Promise<{ bridge: ServerBridge; spies: Spies }> {
  const spies: Spies = { cancelled: [], interrupted: [], stopped: 0, debug: [], perms: [] };
  const bridge = new ServerBridge({
    version: '9.9.9',
    config,
    socketPath,
    callbacks: {
      onDebugToggle: (e) => spies.debug.push(e),
      onPermissionsToggle: (m) => spies.perms.push(m),
    },
    actions: {
      cancelSession: (id) => spies.cancelled.push(id),
      interruptSession: (id) => spies.interrupted.push(id),
    },
    getConnections: () => [],
    getSettings: () => ({
      workingDir: '/tmp/x',
      worktreeMode: 'off',
      respondOnlyWhenMentioned: false,
      chrome: false,
      keepAlive: true,
      threadLogsEnabled: true,
      cleanupWorktrees: true,
      autoUpdateEnabled: true,
      stickyDescription: '',
      stickyFooter: '',
    }),
    onSaveSettings: () => {},
    onServerStop: () => {
      spies.stopped++;
    },
  });
  await bridge.listen();
  bridges.push(bridge);
  return { bridge, spies };
}

function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
      setTimeout(tick, 10);
    };
    tick();
  });
}

describe('ServerBridge command routing', () => {
  test('session:cancel and session:interrupt reach the action handlers', async () => {
    const socketPath = tmpSocket();
    const { spies } = await makeBridge(socketPath);
    const client = await ControlClient.tryConnect(socketPath);

    client!.send({ t: 'session:cancel', sessionId: 'slack:thread-1' });
    client!.send({ t: 'session:interrupt', sessionId: 'mm:thread-2' });

    await waitFor(() => spies.cancelled.length > 0 && spies.interrupted.length > 0);
    expect(spies.cancelled).toEqual(['slack:thread-1']);
    expect(spies.interrupted).toEqual(['mm:thread-2']);
    client!.close();
  });

  test('server:stop invokes onServerStop', async () => {
    const socketPath = tmpSocket();
    const { spies } = await makeBridge(socketPath);
    const client = await ControlClient.tryConnect(socketPath);

    client!.send({ t: 'server:stop' });
    await waitFor(() => spies.stopped > 0);
    expect(spies.stopped).toBe(1);
    client!.close();
  });

  test('toggle commands invoke the base callbacks', async () => {
    const socketPath = tmpSocket();
    const { spies } = await makeBridge(socketPath);
    const client = await ControlClient.tryConnect(socketPath);

    client!.send({ t: 'toggle:debug', enabled: true });
    client!.send({ t: 'toggle:permissions', mode: 'bypass' });

    await waitFor(() => spies.debug.length > 0 && spies.perms.length > 0);
    expect(spies.debug).toEqual([true]);
    expect(spies.perms).toEqual(['bypass']);
    client!.close();
  });
});

describe('ServerBridge connection routing', () => {
  test('connection:save reaches the handler and broadcasts a result', async () => {
    const socketPath = tmpSocket();
    const { bridge } = await makeBridge(socketPath);
    const saved: unknown[] = [];
    bridge.setConnectionHandlers({
      addOrUpdateConnection: async (cfg) => {
        saved.push(cfg);
        return { ok: true };
      },
      removeConnection: async () => ({ ok: true }),
    });

    const client = await ControlClient.tryConnect(socketPath);
    const events: ServerEvent[] = [];
    client!.onEvent((ev) => events.push(ev));

    client!.send({
      t: 'connection:save',
      config: { id: 'new-mm', type: 'mattermost' } as never,
    });

    await waitFor(() => events.some((e) => e.t === 'connection:result'));
    expect(saved).toHaveLength(1);
    const result = events.find((e) => e.t === 'connection:result') as Extract<
      ServerEvent,
      { t: 'connection:result' }
    >;
    expect(result.id).toBe('new-mm');
    expect(result.ok).toBe(true);
    client!.close();
  });

  test('connection:save reports failure when the handler rejects the config', async () => {
    const socketPath = tmpSocket();
    const { bridge } = await makeBridge(socketPath);
    bridge.setConnectionHandlers({
      addOrUpdateConnection: async () => ({ ok: false, error: 'bad token' }),
      removeConnection: async () => ({ ok: true }),
    });

    const client = await ControlClient.tryConnect(socketPath);
    const events: ServerEvent[] = [];
    client!.onEvent((ev) => events.push(ev));

    client!.send({ t: 'connection:save', config: { id: 'x', type: 'slack' } as never });
    await waitFor(() => events.some((e) => e.t === 'connection:result'));
    const result = events.find((e) => e.t === 'connection:result') as Extract<
      ServerEvent,
      { t: 'connection:result' }
    >;
    expect(result.ok).toBe(false);
    expect(result.error).toBe('bad token');
    client!.close();
  });

  test('connection:save before handlers are registered reports "not ready"', async () => {
    const socketPath = tmpSocket();
    await makeBridge(socketPath); // no setConnectionHandlers
    const client = await ControlClient.tryConnect(socketPath);
    const events: ServerEvent[] = [];
    client!.onEvent((ev) => events.push(ev));

    client!.send({ t: 'connection:remove', id: 'nope' });
    await waitFor(() => events.some((e) => e.t === 'connection:result'));
    const result = events.find((e) => e.t === 'connection:result') as Extract<
      ServerEvent,
      { t: 'connection:result' }
    >;
    expect(result.ok).toBe(false);
    expect(result.error).toBe('not ready');
    client!.close();
  });
});

describe('ServerBridge snapshot + broadcast', () => {
  test('snapshot carries config and live toggles', async () => {
    const socketPath = tmpSocket();
    await makeBridge(socketPath);
    const client = await ControlClient.tryConnect(socketPath);
    expect(client!.snapshot.config.version).toBe('9.9.9');
    expect(client!.snapshot.toggles.permissionMode).toBe('auto');
    client!.close();
  });

  test('platform status in the snapshot carries its id (console can match it)', async () => {
    const socketPath = tmpSocket();
    const { bridge } = await makeBridge(socketPath);
    // Minimal no-op provider so wrapProvider() has something to delegate to.
    const noop = () => {};
    const stub = {
      start: async () => {},
      stop: async () => {},
      waitUntilExit: async () => {},
      setReady: noop,
      setShuttingDown: noop,
      addSession: noop,
      updateSession: noop,
      removeSession: noop,
      addLog: noop,
      setPlatformStatus: noop,
      setUpdateState: noop,
      getToggles: () => ({
        debugMode: false,
        permissionMode: 'auto' as const,
        chromeEnabled: false,
        keepAliveEnabled: true,
        updateModalVisible: false,
        logsFocused: false,
      }),
    };
    const wrapped = bridge.wrapProvider(stub);
    wrapped.setPlatformStatus('slack', { connected: true, enabled: true, displayName: 'Main' });

    const client = await ControlClient.tryConnect(socketPath);
    const p = client!.snapshot.platforms.find((x) => x.id === 'slack');
    expect(p).toBeDefined();
    expect(p!.connected).toBe(true);
    expect(p!.enabled).toBe(true);
    client!.close();
  });

  test('snapshot includes the (redacted) connection list', async () => {
    const socketPath = tmpSocket();
    await makeBridge(socketPath);
    const client = await ControlClient.tryConnect(socketPath);
    expect(Array.isArray(client!.snapshot.connections)).toBe(true);
    client!.close();
  });

  test('broadcastConnections pushes a connections event to consoles', async () => {
    const socketPath = tmpSocket();
    const { bridge } = await makeBridge(socketPath);
    const client = await ControlClient.tryConnect(socketPath);
    const events: ServerEvent[] = [];
    client!.onEvent((ev) => events.push(ev));

    bridge.broadcastConnections();
    await waitFor(() => events.some((e) => e.t === 'connections'));
    expect(events.find((e) => e.t === 'connections')).toBeDefined();
    client!.close();
  });

  test('a locally-flipped toggle broadcasts to attached consoles', async () => {
    const socketPath = tmpSocket();
    const { bridge } = await makeBridge(socketPath);
    const client = await ControlClient.tryConnect(socketPath);

    const events: ServerEvent[] = [];
    client!.onEvent((ev) => events.push(ev));

    // Simulate the server's own TUI flipping permissions locally.
    bridge.wrapCallbacks().onPermissionsToggle?.('bypass');

    await waitFor(() => events.some((e) => e.t === 'toggles'));
    const ev = events.find((e) => e.t === 'toggles') as Extract<ServerEvent, { t: 'toggles' }>;
    expect(ev.toggles.permissionMode).toBe('bypass');
    client!.close();
  });
});
