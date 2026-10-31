import { describe, test, expect, afterEach } from 'bun:test';
import { tmpdir } from 'os';
import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { ControlServer } from './server.js';
import { ControlClient } from './client.js';
import type { Snapshot, ClientCommand, ServerEvent } from './protocol.js';

function makeSnapshot(): Snapshot {
  return {
    config: {
      version: '9.9.9',
      workingDir: '/tmp/x',
      claudeVersion: '2.1.0',
      claudeCompatible: true,
      permissionMode: 'auto',
      chromeEnabled: false,
      keepAliveEnabled: true,
    },
    toggles: {
      debugMode: false,
      permissionMode: 'auto',
      chromeEnabled: false,
      keepAliveEnabled: true,
      updateModalVisible: false,
      logsFocused: false,
    },
    sessions: [],
    platforms: [],
    logs: [],
    update: null,
    ready: true,
    shuttingDown: false,
    connections: [],
    settings: {
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
    },
  };
}

let uniq = 0;
function tmpSocket(): string {
  return join(tmpdir(), `ct-ipc-${process.pid}-${uniq++}.sock`);
}

const servers: ControlServer[] = [];
async function startServer(opts: {
  onCommand?: (c: ClientCommand) => void;
  getSnapshot?: () => Snapshot;
  socketPath: string;
}): Promise<ControlServer> {
  const server = new ControlServer({
    version: '9.9.9',
    socketPath: opts.socketPath,
    getSnapshot: opts.getSnapshot ?? makeSnapshot,
    onCommand: opts.onCommand ?? (() => {}),
  });
  await server.listen();
  servers.push(server);
  return server;
}

afterEach(async () => {
  while (servers.length) await servers.pop()!.close();
});

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

describe('ControlClient.tryConnect', () => {
  test('returns null when no server is listening', async () => {
    const client = await ControlClient.tryConnect(tmpSocket());
    expect(client).toBeNull();
  });

  test('attaches and receives hello + snapshot', async () => {
    const socketPath = tmpSocket();
    await startServer({ socketPath });

    const client = await ControlClient.tryConnect(socketPath);
    expect(client).not.toBeNull();
    expect(client!.serverVersion).toBe('9.9.9');
    expect(client!.serverPid).toBe(process.pid);
    expect(client!.snapshot.config.version).toBe('9.9.9');
    expect(client!.snapshot.ready).toBe(true);
    client!.close();
  });
});

describe('control channel roundtrip', () => {
  test('server broadcast reaches the client', async () => {
    const socketPath = tmpSocket();
    const server = await startServer({ socketPath });
    const client = await ControlClient.tryConnect(socketPath);

    const events: ServerEvent[] = [];
    client!.onEvent((ev) => events.push(ev));

    server.broadcast({ t: 'session:add', session: { id: 's1' } as never });
    await waitFor(() => events.some((e) => e.t === 'session:add'));

    const ev = events.find((e) => e.t === 'session:add') as Extract<
      ServerEvent,
      { t: 'session:add' }
    >;
    expect(ev.session.id).toBe('s1');
    client!.close();
  });

  test('client command reaches the server', async () => {
    const socketPath = tmpSocket();
    const received: ClientCommand[] = [];
    await startServer({ socketPath, onCommand: (c) => received.push(c) });

    const client = await ControlClient.tryConnect(socketPath);
    client!.send({ t: 'toggle:permissions', mode: 'bypass' });

    await waitFor(() => received.length > 0);
    expect(received[0]).toEqual({ t: 'toggle:permissions', mode: 'bypass' });
    client!.close();
  });

  test('closing the server notifies the client with bye', async () => {
    const socketPath = tmpSocket();
    const server = await startServer({ socketPath });
    const client = await ControlClient.tryConnect(socketPath);

    const reasons: string[] = [];
    client!.onClose((reason) => {
      reasons.push(reason);
    });

    await server.close('going away');
    await waitFor(() => reasons.length > 0);
    expect(reasons[0]).toBe('going away');
  });
});

describe('stale socket cleanup', () => {
  test('a new server reclaims a stranded POSIX socket path', async () => {
    if (process.platform === 'win32') return; // named pipes have no file to strand
    const socketPath = tmpSocket();

    // Simulate what a crashed instance leaves behind: a file sitting at the
    // socket path. Binding over it fails EADDRINUSE, which our listen() must
    // recover from by unlinking and retrying once.
    writeFileSync(socketPath, '');
    expect(existsSync(socketPath)).toBe(true);

    await startServer({ socketPath }); // must not throw
    const client = await ControlClient.tryConnect(socketPath);
    expect(client).not.toBeNull();
    client!.close();
  });
});
