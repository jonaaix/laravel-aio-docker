/**
 * realtest — a tiny in-process fake Mattermost (HTTP + WebSocket).
 *
 * Implements just enough of the Mattermost API for the bot's MattermostClient
 * to connect and converse, so the realtest can be fully self-contained: no real
 * server, no human token. We are simultaneously the transport AND the "human"
 * driving the conversation, while the bots still talk to REAL LLMs.
 *
 * Surface the client actually uses (see src/platform/mattermost/client.ts):
 *   REST:  GET /users/me · /users/username/:n · /users/:id
 *          POST /posts · GET /posts/:root/thread
 *          GET /channels/:id/pinned · /channels/:id/posts?after=
 *          POST /reactions
 *   WS:    connect → client sends {action:'authentication_challenge',data:{token}}
 *          server replies {event:'hello'} then streams {event:'posted', data:{post:<json string>}}
 */
import type { Server, ServerWebSocket } from 'bun';

export interface FakeUser {
  id: string;
  username: string;
  token: string;
  isBot: boolean;
}

export interface FakePost {
  id: string;
  create_at: number;
  user_id: string;
  channel_id: string;
  message: string;
  root_id: string;
  props?: Record<string, unknown>;
}

interface WsData {
  userId?: string;
}

export class FakeMattermost {
  private server?: Server<WsData>;
  private users: FakeUser[] = [];
  private posts: FakePost[] = [];
  private sockets = new Set<ServerWebSocket<WsData>>();
  private seq = 1;
  private idCounter = 0;
  private clock = 1_700_000_000_000;
  // Per-run tag so post/thread ids never collide with a PRIOR run's persisted
  // sessions (which would make the bot "resume" a stale session and pollute the
  // test). Randomized per FakeMattermost instance.
  private readonly runTag = Math.random().toString(36).slice(2, 8);

  /**
   * @param channelId must equal the bots' configured channelId (they filter on it).
   * @param port fixed port for the live-repoint flow, or 0 for an ephemeral port.
   */
  constructor(
    readonly channelId = 'realtest-channel',
    private readonly port = 0,
  ) {}

  /** Register a user (bot or human) and return it (with a token). */
  addUser(username: string, isBot: boolean): FakeUser {
    const u: FakeUser = { id: this.mkId('u'), username, token: this.mkId('tok'), isBot };
    this.users.push(u);
    return u;
  }

  /**
   * Register a bot using its REAL token + username (from the operator's config),
   * so their already-running bot is recognized when it connects here.
   */
  addExistingBot(username: string, token: string): FakeUser {
    const u: FakeUser = { id: this.mkId('u'), username, token, isBot: true };
    this.users.push(u);
    return u;
  }

  /** Number of authenticated bot websockets currently connected. */
  connectedCount(): number {
    return this.sockets.size;
  }

  get url(): string {
    if (!this.server) throw new Error('FakeMattermost not started');
    return `http://localhost:${this.server.port}`;
  }

  async start(): Promise<void> {
    // Arrow handlers capture `this` lexically (no this-aliasing).
    this.server = Bun.serve<WsData>({
      port: this.port, // 0 = ephemeral (isolated harness); fixed for live-repoint
      fetch: (req, server) => {
        const url = new URL(req.url);
        // WebSocket upgrade
        if (url.pathname === '/api/v4/websocket') {
          if (server.upgrade(req, { data: {} })) return undefined;
          return new Response('upgrade failed', { status: 400 });
        }
        return this.handleRest(req, url);
      },
      websocket: {
        message: (ws, raw) => {
          this.handleWsMessage(ws, typeof raw === 'string' ? raw : raw.toString());
        },
        close: (ws) => {
          this.sockets.delete(ws);
        },
      },
    });
  }

  async stop(): Promise<void> {
    this.server?.stop(true);
    this.server = undefined;
    this.sockets.clear();
  }

  // ---- driving (as the human) --------------------------------------------

  /** Post as a user (default: the human driver) and broadcast it to the bots. */
  post(userId: string, message: string, rootId?: string): FakePost {
    const post: FakePost = {
      id: this.mkId('p'),
      create_at: this.now(),
      user_id: userId,
      channel_id: this.channelId,
      message,
      root_id: rootId ?? '',
    };
    this.posts.push(post);
    this.broadcastPosted(post);
    return post;
  }

  /** All posts in a thread (root + replies), chronological. */
  thread(rootId: string): FakePost[] {
    return this.posts
      .filter((p) => p.id === rootId || p.root_id === rootId)
      .sort((a, b) => a.create_at - b.create_at);
  }

  userById(id: string): FakeUser | undefined {
    return this.users.find((u) => u.id === id);
  }

  // ---- REST ---------------------------------------------------------------

  private handleRest(req: Request, url: URL): Response | Promise<Response> {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const me = this.users.find((u) => u.token === token);
    const p = url.pathname;

    if (!me) return json({ message: 'unauthorized' }, 401);

    if (req.method === 'GET' && p === '/api/v4/users/me') return json(this.pubUser(me));

    let m = p.match(/^\/api\/v4\/users\/username\/(.+)$/);
    if (req.method === 'GET' && m) {
      const u = this.users.find((x) => x.username === decodeURIComponent(m![1]));
      return u ? json(this.pubUser(u)) : json({ message: 'not found' }, 404);
    }
    m = p.match(/^\/api\/v4\/users\/([^/]+)$/);
    if (req.method === 'GET' && m) {
      const u = this.userById(m[1]);
      return u ? json(this.pubUser(u)) : json({ message: 'not found' }, 404);
    }

    if (req.method === 'POST' && p === '/api/v4/posts') {
      // body is async; handle in a promise-returning path
      return this.createPostResponse(req, me);
    }

    m = p.match(/^\/api\/v4\/posts\/([^/]+)\/thread$/);
    if (req.method === 'GET' && m) return json(this.threadResponse(m[1]));

    if (req.method === 'GET' && /\/pinned$/.test(p)) return json({ order: [], posts: {} });

    m = p.match(/^\/api\/v4\/channels\/([^/]+)\/posts$/);
    if (req.method === 'GET' && m) {
      const after = url.searchParams.get('after') || '';
      const idx = this.posts.findIndex((x) => x.id === after);
      const rest = idx >= 0 ? this.posts.slice(idx + 1) : [];
      return json({ order: rest.map((x) => x.id), posts: byId(rest) });
    }

    if (req.method === 'POST' && p === '/api/v4/reactions') return json({}, 201);

    // Permissive no-op for anything else (e.g. sticky-message edits/pins) so the
    // bot's best-effort calls don't spam errors. This is a test fake, not MM.
    return json({}, 200);
  }

  private async createPostResponse(req: Request, me: FakeUser): Promise<Response> {
    const body = (await req.json().catch(() => ({}))) as {
      channel_id?: string;
      message?: string;
      root_id?: string;
      props?: Record<string, unknown>;
    };
    const post: FakePost = {
      id: this.mkId('p'),
      create_at: this.now(),
      user_id: me.id,
      channel_id: body.channel_id || this.channelId,
      message: body.message || '',
      root_id: body.root_id || '',
      props: body.props,
    };
    this.posts.push(post);
    this.broadcastPosted(post);
    return json(post, 201);
  }

  private threadResponse(rootId: string): { order: string[]; posts: Record<string, FakePost> } {
    const t = this.thread(rootId);
    return { order: t.map((p) => p.id), posts: byId(t) };
  }

  // ---- WebSocket ----------------------------------------------------------

  private handleWsMessage(ws: ServerWebSocket<WsData>, raw: string): void {
    let msg: { action?: string; data?: { token?: string } };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.action === 'authentication_challenge') {
      const user = this.users.find((u) => u.token === msg.data?.token);
      if (!user) {
        ws.close(4001, 'bad token');
        return;
      }
      ws.data.userId = user.id;
      this.sockets.add(ws);
      // Mattermost sends a status_change then hello; the client only needs hello.
      ws.send(JSON.stringify({ event: 'hello', data: { server_version: 'fake' }, seq: this.seq++ }));
    }
    // user_typing and other actions are ignored.
  }

  private broadcastPosted(post: FakePost): void {
    const event = JSON.stringify({
      event: 'posted',
      data: { post: JSON.stringify(post), channel_type: 'O', sender_name: this.userById(post.user_id)?.username },
      broadcast: { channel_id: post.channel_id },
      seq: this.seq++,
    });
    for (const ws of this.sockets) ws.send(event);
  }

  // ---- helpers ------------------------------------------------------------

  private pubUser(u: FakeUser): { id: string; username: string } {
    return { id: u.id, username: u.username };
  }
  private mkId(prefix: string): string {
    return `${prefix}${(++this.idCounter).toString().padStart(6, '0')}${this.runTag}`;
  }
  private now(): number {
    // Monotonic, deterministic-ish clock so ordering checks are meaningful.
    this.clock += 1;
    return this.clock;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function byId(posts: FakePost[]): Record<string, FakePost> {
  const o: Record<string, FakePost> = {};
  for (const p of posts) o[p.id] = p;
  return o;
}
