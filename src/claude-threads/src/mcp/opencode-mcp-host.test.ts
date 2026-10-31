import { describe, it, expect, afterEach } from 'bun:test';
import { mkdtemp, writeFile, realpath } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { OpencodeMcpHost, type OpencodeMcpPlatformConfig } from './opencode-mcp-host.js';

const platform: OpencodeMcpPlatformConfig = {
  type: 'mattermost',
  url: 'https://mm.example',
  token: 'tok',
  channelId: 'chan',
  allowedUsers: ['alice'],
};

// Connect a real MCP client to the host over Streamable HTTP, exactly as
// opencode does — this drives the initialize → tools/list → tools/call path.
async function connect(url: string): Promise<Client> {
  const client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  return client;
}

describe('OpencodeMcpHost', () => {
  let host: OpencodeMcpHost;
  afterEach(async () => { await host?.shutdown(); });

  it('exposes the full Claude tool set (minus permission_prompt)', async () => {
    host = new OpencodeMcpHost();
    const { url } = await host.registerSession({
      platform, threadId: 't1', allowedRoots: ['/tmp'], outboundEnabled: true, maxBytes: 0, sessionOwnerUsername: "alice", promptTimeoutMs: 1000,
    });
    const client = await connect(url);
    const names = (await client.listTools()).tools.map((t) => t.name).sort();
    await client.close();

    // Parity with the Claude stdio server (which additionally has
    // permission_prompt — Claude-only, opencode handles permissions itself).
    expect(names).toEqual([
      'list_thread', 'react_to_post', 'read_channel_history', 'read_post',
      'search_messages', 'send_dm', 'send_file', 'update_own_post',
    ]);
    expect(names).not.toContain('permission_prompt');
  });

  it('send_file uploads via the session api into the session thread', async () => {
    // Fake api records the uploadFile args so we can assert thread scoping.
    const uploads: Array<{ path: string; threadId: string }> = [];
    host = new OpencodeMcpHost();
    // Inject a fake api by pre-seeding the cache through a subclass-free hook:
    // register, then overwrite the built api on the stored session.
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'ochost-')));
    const file = join(dir, 'shot.png');
    await writeFile(file, 'PNGDATA');

    const { url, token } = await host.registerSession({
      platform, threadId: 'thread-xyz', allowedRoots: [dir], outboundEnabled: true, maxBytes: 0, sessionOwnerUsername: "alice", promptTimeoutMs: 1000,
    });
    // Replace the api with a fake (the real one would hit the network).
    (host as unknown as { sessions: Map<string, { api: unknown }> }).sessions.get(token)!.api = {
      uploadFile: async (p: string, threadId: string) => { uploads.push({ path: p, threadId }); return { postId: 'p1' }; },
    } as never;

    const client = await connect(url);
    const res = await client.callTool({ name: 'send_file', arguments: { path: file, caption: 'hi' } });
    await client.close();

    const payload = JSON.parse((res.content as Array<{ text: string }>)[0].text);
    expect(payload.ok).toBe(true);
    expect(payload.postId).toBe('p1');
    expect(uploads).toEqual([{ path: file, threadId: 'thread-xyz' }]);
  });

  it('send_file rejects a path outside the allowed roots', async () => {
    host = new OpencodeMcpHost();
    const { url, token } = await host.registerSession({
      platform, threadId: 't1', allowedRoots: ['/allowed/only'], outboundEnabled: true, maxBytes: 0, sessionOwnerUsername: "alice", promptTimeoutMs: 1000,
    });
    (host as unknown as { sessions: Map<string, { api: unknown }> }).sessions.get(token)!.api = {
      uploadFile: async () => { throw new Error('should not be called'); },
    } as never;

    const client = await connect(url);
    const res = await client.callTool({ name: 'send_file', arguments: { path: '/etc/passwd' } });
    await client.close();

    const payload = JSON.parse((res.content as Array<{ text: string }>)[0].text);
    expect(payload.ok).toBe(false);
  });

  it('isolates two sessions: each send_file targets its own thread', async () => {
    const seen: Array<{ threadId: string }> = [];
    host = new OpencodeMcpHost();
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'ochost-')));
    const file = join(dir, 'a.png');
    await writeFile(file, 'x');
    const fakeApi = (bucket: typeof seen) => ({
      uploadFile: async (_p: string, threadId: string) => { bucket.push({ threadId }); return { postId: 'p' }; },
    });

    const a = await host.registerSession({ platform, threadId: 'thread-A', allowedRoots: [dir], outboundEnabled: true, maxBytes: 0, sessionOwnerUsername: "alice", promptTimeoutMs: 1000 });
    const b = await host.registerSession({ platform, threadId: 'thread-B', allowedRoots: [dir], outboundEnabled: true, maxBytes: 0, sessionOwnerUsername: "alice", promptTimeoutMs: 1000 });
    const sessions = (host as unknown as { sessions: Map<string, { api: unknown }> }).sessions;
    sessions.get(a.token)!.api = fakeApi(seen) as never;
    sessions.get(b.token)!.api = fakeApi(seen) as never;

    const ca = await connect(a.url);
    const cb = await connect(b.url);
    await ca.callTool({ name: 'send_file', arguments: { path: file } });
    await cb.callTool({ name: 'send_file', arguments: { path: file } });
    await ca.close();
    await cb.close();

    expect(seen).toEqual([{ threadId: 'thread-A' }, { threadId: 'thread-B' }]);
  });

  it('unregisterSession makes the token stop initializing new clients', async () => {
    host = new OpencodeMcpHost();
    const { url, token } = await host.registerSession({
      platform, threadId: 't1', allowedRoots: ['/tmp'], outboundEnabled: true, maxBytes: 0, sessionOwnerUsername: "alice", promptTimeoutMs: 1000,
    });
    host.unregisterSession(token);

    const client = new Client({ name: 'test', version: '1.0.0' });
    await expect(
      client.connect(new StreamableHTTPClientTransport(new URL(url))),
    ).rejects.toThrow();
  });
});
