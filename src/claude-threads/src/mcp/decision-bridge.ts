import { createServer, createConnection, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';

export interface BridgeRequest {
  kind: 'plan_approval' | 'question';
  toolName: string;
  input: Record<string, unknown>;
}

export interface BridgeResponse {
  behavior: 'allow' | 'deny';
  updatedInput?: Record<string, unknown>;
  message?: string;
}

export class BridgeUnavailableError extends Error {}

export type BridgeDecisionHandler = (
  req: BridgeRequest,
  signal: AbortSignal
) => Promise<BridgeResponse>;

const MAX_BRIDGE_REQUEST_BYTES = 1024 * 1024;

export function bridgeSocketPath(): string {
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\ctb-${randomUUID()}`;
  }
  // Short name in a fresh 0700 dir: macOS truncates unix socket paths beyond 104 bytes.
  const dir = mkdtempSync(join(tmpdir(), 'ctb-'));
  return join(dir, 'b.sock');
}

export class DecisionBridgeServer {
  private constructor(
    private readonly server: Server,
    private readonly liveSockets: Set<Socket>,
    public readonly path: string
  ) {}

  static async create(handler: BridgeDecisionHandler): Promise<DecisionBridgeServer> {
    const path = bridgeSocketPath();
    const liveSockets = new Set<Socket>();
    const server = createServer((socket) => serveConnection(socket, handler, liveSockets));

    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(path, () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
    } catch (err) {
      await removeSocketDir(path);
      throw err;
    }

    return new DecisionBridgeServer(server, liveSockets, path);
  }

  async close(): Promise<void> {
    for (const socket of this.liveSockets) socket.destroy();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
    await removeSocketDir(this.path);
  }
}

function serveConnection(
  socket: Socket,
  handler: BridgeDecisionHandler,
  liveSockets: Set<Socket>
): void {
  liveSockets.add(socket);
  socket.once('close', () => liveSockets.delete(socket));
  let buffer = '';
  let responded = false;
  const aborter = new AbortController();

  const respond = (payload: unknown) => {
    responded = true;
    socket.end(JSON.stringify(payload) + '\n');
  };

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const newline = buffer.indexOf('\n');
    if (newline === -1) {
      if (buffer.length > MAX_BRIDGE_REQUEST_BYTES) {
        buffer = '';
        responded = true;
        socket.destroy();
      }
      return;
    }
    const line = buffer.slice(0, newline);
    buffer = '';
    let request: BridgeRequest;
    try {
      request = JSON.parse(line) as BridgeRequest;
    } catch {
      respond({ behavior: 'deny', message: 'Malformed bridge request' });
      return;
    }
    handler(request, aborter.signal)
      .then(respond)
      .catch((err) => {
        if (err instanceof BridgeUnavailableError) {
          responded = true;
          socket.destroy();
          return;
        }
        respond({
          behavior: 'deny',
          message: `Bridge handler failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      });
  });
  socket.on('close', () => {
    if (!responded) aborter.abort();
  });
  socket.on('error', () => {});
}

async function removeSocketDir(path: string): Promise<void> {
  if (process.platform === 'win32') return;
  await rm(join(path, '..'), { recursive: true, force: true }).catch(() => {});
}

export function requestBridgeDecision(
  path: string,
  request: BridgeRequest,
  timeoutMs: number
): Promise<BridgeResponse> {
  return new Promise<BridgeResponse>((resolve, reject) => {
    const socket = createConnection(path);
    let buffer = '';
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    };

    const timer = setTimeout(
      () => fail(new Error(`Bridge decision timed out after ${timeoutMs}ms`)),
      timeoutMs
    );

    socket.on('connect', () => {
      socket.write(JSON.stringify(request) + '\n');
    });
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const newline = buffer.indexOf('\n');
      if (newline === -1 || settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      try {
        resolve(JSON.parse(buffer.slice(0, newline)) as BridgeResponse);
      } catch {
        reject(new Error('Malformed bridge response'));
      }
    });
    socket.on('error', (err) => fail(err));
    socket.on('close', () => fail(new Error('Bridge connection closed before a decision arrived')));
  });
}
