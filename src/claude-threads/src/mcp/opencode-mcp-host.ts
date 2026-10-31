/**
 * In-process MCP host for opencode sessions.
 *
 * The Claude backend gets the claude-threads MCP tools by spawning a stdio
 * child (`node mcp-server.js`) per session — one process + one platform
 * connection each. opencode uses a client/server model where a single server
 * hosts many sessions, so a per-session child process would be wasteful (nine
 * advisory bots × one process per active session).
 *
 * Instead this module hosts ONE Streamable-HTTP MCP server INSIDE the bot
 * process and registers it with opencode as a REMOTE MCP (per session, via a
 * unique URL token). No child processes, no extra platform connections — the
 * tool handlers run in-process and reuse the same `handle*With` cores as the
 * stdio server. Verified against opencode 1.17/1.18: the remote MCP connects
 * over Streamable HTTP (stateful; opencode opens a GET SSE stream after
 * `initialize`, so a session id is required).
 *
 * Per-session isolation: each opencode session registers its own URL
 * (`/mcp/<token>`); the token binds that session's thread + working dir, so a
 * bot's `send_file` always lands in the right thread even with several
 * concurrent threads. `permission_prompt` is intentionally NOT exposed —
 * opencode has its own permission flow (handled in agent.ts).
 */

import http from 'http';
import { randomUUID } from 'crypto';
import type { AddressInfo } from 'net';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { registerClaudeThreadsTools, createSendDmState } from './mcp-server.js';
import { createMcpPlatformApi } from '../platform/mcp-platform-api-factory.js';
import type { McpPlatformApi, MattermostMcpApiConfig, SlackMcpApiConfig } from '../platform/mcp-platform-api.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('opencode-mcp');

/** Per-bot platform config (from `platform.getMcpConfig()`), used to build the McpApi. */
export interface OpencodeMcpPlatformConfig {
  type: string;
  url: string;
  token: string;
  channelId: string;
  allowedUsers: string[];
  appToken?: string;
}

/** Everything one opencode session needs to expose the tools scoped to itself. */
export interface OpencodeMcpSession {
  platform: OpencodeMcpPlatformConfig;
  /** Thread `send_file` posts into (the session's thread root). */
  threadId: string;
  /** Roots `send_file` may read from (working dir + upload dir). */
  allowedRoots: string[];
  /** Outbound-file toggle + cap (mirrors the Claude backend's env). */
  outboundEnabled: boolean;
  maxBytes: number;
  /** Session owner (send_dm attribution). */
  sessionOwnerUsername: string;
  /** Timeout for send_dm's per-recipient permission prompt. */
  promptTimeoutMs: number;
}

interface RegisteredSession extends OpencodeMcpSession {
  api: McpPlatformApi;
  /** Per-session send_dm state (rate-limit counters, member/label caches). */
  sendDm: ReturnType<typeof createSendDmState>;
}

const MAX_OUTBOUND_BYTES = 100 * 1024 * 1024;

/** Build the McpApi for a bot from its platform config. No connection is opened. */
function buildApi(platform: OpencodeMcpPlatformConfig): McpPlatformApi {
  if (platform.type === 'slack') {
    const cfg: SlackMcpApiConfig = {
      platformType: 'slack',
      botToken: platform.token,
      appToken: platform.appToken ?? '',
      channelId: platform.channelId,
      allowedUsers: platform.allowedUsers,
    };
    return createMcpPlatformApi('slack', cfg);
  }
  const cfg: MattermostMcpApiConfig = {
    platformType: 'mattermost',
    url: platform.url,
    token: platform.token,
    channelId: platform.channelId,
    allowedUsers: platform.allowedUsers,
  };
  return createMcpPlatformApi('mattermost', cfg);
}

export class OpencodeMcpHost {
  private server: http.Server | null = null;
  private baseUrl: string | null = null;
  private startPromise: Promise<void> | null = null;
  /** token → session config (one per opencode session). */
  private readonly sessions = new Map<string, RegisteredSession>();
  /** mcp-session-id → { transport, token } for stateful routing. */
  private readonly transports = new Map<string, { transport: StreamableHTTPServerTransport; token: string }>();
  /** Reused McpApi per bot, keyed by a config fingerprint (no per-session state). */
  private readonly apiCache = new Map<string, McpPlatformApi>();

  /** Start the HTTP server once (auto-picks a loopback port). Idempotent. */
  ensureStarted(): Promise<void> {
    if (this.baseUrl) return Promise.resolve();
    if (this.startPromise) return this.startPromise;
    this.startPromise = new Promise<void>((resolve, reject) => {
      const server = http.createServer((req, res) => this.handle(req, res));
      server.on('error', reject);
      // 127.0.0.1 only: the MCP tools act with the bot token, so the endpoint
      // must never be reachable off-box. opencode runs on the same host.
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address() as AddressInfo;
        this.server = server;
        this.baseUrl = `http://127.0.0.1:${port}`;
        log.info(`in-process MCP host listening at ${this.baseUrl}`);
        resolve();
      });
    });
    return this.startPromise;
  }

  /**
   * Register a session and return the remote-MCP URL opencode should connect
   * to. The caller registers it with opencode via `client.mcp.add`.
   */
  async registerSession(session: OpencodeMcpSession): Promise<{ url: string; token: string }> {
    await this.ensureStarted();
    const token = randomUUID();
    const fingerprint = `${session.platform.type}|${session.platform.url}|${session.platform.token}|${session.platform.channelId}`;
    let api = this.apiCache.get(fingerprint);
    if (!api) {
      api = buildApi(session.platform);
      this.apiCache.set(fingerprint, api);
    }
    this.sessions.set(token, { ...session, api, sendDm: createSendDmState() });
    return { url: `${this.baseUrl}/mcp/${token}`, token };
  }

  /** Drop a session and tear down any live transports bound to its token. */
  unregisterSession(token: string): void {
    this.sessions.delete(token);
    for (const [sid, entry] of this.transports) {
      if (entry.token === token) {
        try { void entry.transport.close(); } catch { /* best-effort */ }
        this.transports.delete(sid);
      }
    }
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url ?? '', this.baseUrl ?? 'http://127.0.0.1');
    const match = url.pathname.match(/^\/mcp\/([^/]+)$/);
    if (!match) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    const token = match[1];
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: unknown;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
      } catch {
        body = undefined;
      }
      void this.route(token, req, res, body);
    });
    req.on('error', () => {
      if (!res.headersSent) { res.statusCode = 400; res.end('bad request'); }
    });
  }

  private async route(
    token: string,
    req: http.IncomingMessage,
    res: http.ServerResponse,
    body: unknown,
  ): Promise<void> {
    const sid = req.headers['mcp-session-id'] as string | undefined;
    try {
      let transport: StreamableHTTPServerTransport;
      const existing = sid ? this.transports.get(sid) : undefined;
      if (existing) {
        transport = existing.transport;
      } else if (!sid && isInitializeRequest(body)) {
        const session = this.sessions.get(token);
        if (!session) {
          res.statusCode = 404;
          res.end('unknown session');
          return;
        }
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => { this.transports.set(id, { transport, token }); },
        });
        transport.onclose = () => {
          if (transport.sessionId) this.transports.delete(transport.sessionId);
        };
        await this.buildServer(session).connect(transport);
      } else {
        // Non-initialize request without a known session id.
        res.statusCode = 400;
        res.end('no valid session');
        return;
      }
      await transport.handleRequest(req, res, body);
    } catch (err) {
      log.warn(`MCP request failed: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('internal error');
      }
    }
  }

  /**
   * Build an McpServer exposing this session's tools via the SHARED registry —
   * the exact same set the Claude stdio server registers (minus
   * permission_prompt, which opencode handles itself). Keeping this on
   * registerClaudeThreadsTools is what guarantees opencode and Claude bots have
   * identical tools.
   */
  private buildServer(session: RegisteredSession): McpServer {
    const server = new McpServer({ name: 'claude-threads-mcp', version: '1.0.0' });
    registerClaudeThreadsTools(server, {
      api: session.api,
      platformType: session.platform.type,
      platformUrl: session.platform.url,
      channelId: session.platform.channelId,
      sessionThreadId: session.threadId,
      allowedRoots: session.allowedRoots,
      outboundEnabled: session.outboundEnabled,
      maxBytes: session.maxBytes > 0 ? session.maxBytes : MAX_OUTBOUND_BYTES,
      sessionOwnerUsername: session.sessionOwnerUsername,
      promptTimeoutMs: session.promptTimeoutMs,
      sendDm: session.sendDm,
    });
    return server;
  }

  /** Shut the host down (bot exit). Safe to call when never started. */
  async shutdown(): Promise<void> {
    for (const { transport } of this.transports.values()) {
      try { await transport.close(); } catch { /* best-effort */ }
    }
    this.transports.clear();
    this.sessions.clear();
    this.apiCache.clear();
    await new Promise<void>((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
    });
    this.server = null;
    this.baseUrl = null;
    this.startPromise = null;
  }
}

/** Process-wide singleton — one in-process MCP host shared by all opencode sessions. */
export const opencodeMcpHost = new OpencodeMcpHost();
