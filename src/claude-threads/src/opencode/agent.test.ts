/**
 * Tests for OpencodeAgent wiring.
 *
 * The agent is glue over the opencode SDK + the shared hub; the interesting
 * translation logic lives in (and is tested by) event-translator.test.ts. Here
 * we verify the glue: session create/resume, event fan-out, promptAsync, abort,
 * and the exit/failure contract — with the hub's methods stubbed so no real
 * `opencode serve` process is needed.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import type { Event } from '@opencode-ai/sdk';
import { OpencodeAgent, parseOpencodeModel } from './agent.js';
import { opencodeServer } from './server.js';
import { opencodeMcpHost } from '../mcp/opencode-mcp-host.js';

// A completed opencode text part → should translate to one assistant event.
const completedText = (text: string): Event =>
  ({
    type: 'message.part.updated',
    properties: {
      part: { id: 'p1', sessionID: 'oc-1', messageID: 'm', type: 'text', text, time: { start: 0, end: 1 } },
    },
  }) as unknown as Event;

interface Stub {
  createResult: { data?: { id: string }; error?: unknown };
  registered?: (e: Event) => void; // the onEvent handed to openStream
  registeredId?: string;           // the session id openStream was called with
  registeredDir?: string;          // the working directory openStream was called with
  streamStarted: boolean;          // stream.start() awaited
  stopped: string[];               // session ids whose stream.stop() ran
  promptCalls: unknown[];
  abortCalls: unknown[];
  permissionReplies: Array<{ permissionID: string; response: string }>;
  mcpAdds: Array<{ name: string; url: string }>;
  mcpDisconnects: string[];
  hostRegistered: number;
  hostUnregistered: string[];
  client: unknown;
}

let stub: Stub;

beforeEach(() => {
  stub = {
    createResult: { data: { id: 'oc-1' } },
    streamStarted: false,
    stopped: [],
    promptCalls: [],
    abortCalls: [],
    permissionReplies: [],
    mcpAdds: [],
    mcpDisconnects: [],
    hostRegistered: 0,
    hostUnregistered: [],
    client: null,
  };
  stub.client = {
    session: {
      create: mock(async () => stub.createResult),
      promptAsync: mock(async (opts: unknown) => {
        stub.promptCalls.push(opts);
        return { error: undefined };
      }),
      abort: mock(async (opts: unknown) => {
        stub.abortCalls.push(opts);
        return { data: true };
      }),
    },
    postSessionIdPermissionsPermissionId: mock(async (opts: { path: { permissionID: string }; body: { response: string } }) => {
      stub.permissionReplies.push({ permissionID: opts.path.permissionID, response: opts.body.response });
      return { data: true };
    }),
    mcp: {
      add: mock(async (opts: { body: { name: string; config: { url: string } } }) => {
        stub.mcpAdds.push({ name: opts.body.name, url: opts.body.config.url });
        return { data: {} };
      }),
      disconnect: mock(async (opts: { path: { name: string } }) => {
        stub.mcpDisconnects.push(opts.path.name);
        return { data: {} };
      }),
    },
  };

  // Shadow the in-process MCP host so tests don't start a real HTTP server.
  (opencodeMcpHost as unknown as { registerSession: (s: unknown) => Promise<{ url: string; token: string }> }).registerSession =
    async () => { stub.hostRegistered += 1; return { url: 'http://127.0.0.1:9/mcp/tok', token: 'tok' }; };
  (opencodeMcpHost as unknown as { unregisterSession: (t: string) => void }).unregisterSession =
    (t: string) => { stub.hostUnregistered.push(t); };

  // Shadow the singleton's methods/getter (own props over prototype). The agent
  // no longer registers with a shared hub — it opens its OWN per-session stream;
  // the fake stream captures the onEvent so tests can drive events, and records
  // start()/stop() so the lifecycle can be asserted.
  (opencodeServer as unknown as { ensureStarted: () => Promise<unknown> }).ensureStarted = async () => stub.client;
  (opencodeServer as unknown as {
    openStream: (id: string, directory: string, fn: (e: Event) => void) => { start: () => Promise<void>; stop: () => void };
  }).openStream = (id, directory, fn) => {
    stub.registeredId = id;
    stub.registeredDir = directory;
    stub.registered = fn;
    return {
      start: async () => {
        stub.streamStarted = true;
      },
      stop: () => {
        stub.stopped.push(id);
      },
    };
  };
  Object.defineProperty(opencodeServer, 'client', { configurable: true, get: () => stub.client });
});

afterEach(() => {
  // Remove own-prop shadows so the real prototype methods/getter come back.
  delete (opencodeServer as unknown as Record<string, unknown>).ensureStarted;
  delete (opencodeServer as unknown as Record<string, unknown>).openStream;
  delete (opencodeServer as unknown as Record<string, unknown>).client;
  delete (opencodeMcpHost as unknown as Record<string, unknown>).registerSession;
  delete (opencodeMcpHost as unknown as Record<string, unknown>).unregisterSession;
});

/** Access the private readiness promise so tests can await init. */
const ready = (a: OpencodeAgent): Promise<void> => (a as unknown as { ready: Promise<void> }).ready;

describe('OpencodeAgent', () => {
  it('creates an opencode session on start and registers for its events', async () => {
    const agent = new OpencodeAgent({ workingDir: '/repo' });
    agent.start();
    await ready(agent);

    expect(stub.registeredId).toBe('oc-1');
    expect(stub.registeredDir).toBe('/repo'); // /event is project-scoped — must subscribe with the session's directory
    expect(stub.streamStarted).toBe(true); // its own SSE stream was started
    expect(agent.getOpencodeSessionId()).toBe('oc-1');
    expect(agent.isRunning()).toBe(true);
  });

  it('resumes an existing session id without creating a new one', async () => {
    const created = (stub.client as { session: { create: ReturnType<typeof mock> } }).session.create;
    const agent = new OpencodeAgent({ workingDir: '/repo', opencodeSessionId: 'resumed-42' });
    agent.start();
    await ready(agent);

    expect(created).not.toHaveBeenCalled();
    expect(stub.registeredId).toBe('resumed-42');
    expect(agent.getOpencodeSessionId()).toBe('resumed-42');
  });

  it('translates incoming opencode events and re-emits them as Claude events', async () => {
    const agent = new OpencodeAgent({ workingDir: '/repo' });
    const seen: Array<{ type: string }> = [];
    agent.on('event', (e: { type: string }) => seen.push(e));
    agent.start();
    await ready(agent);

    // Mark message 'm' as an assistant message first — the translator only
    // surfaces text from assistant messages (see the user-echo regression).
    stub.registered?.({ type: 'message.updated', properties: { info: { role: 'assistant', id: 'm' } } } as unknown as Event);
    stub.registered?.(completedText('Hello from opencode'));

    const assistant = seen.find((e) => e.type === 'assistant') as
      | { message?: { content?: Array<{ text?: string }> } }
      | undefined;
    expect(assistant?.message?.content?.[0]?.text).toBe('Hello from opencode');
  });

  it('sends a prompt via promptAsync with the text part and directory', async () => {
    const agent = new OpencodeAgent({ workingDir: '/repo' });
    agent.start();
    await ready(agent);

    agent.sendMessage('do the thing');
    await new Promise((r) => setTimeout(r, 0)); // let the async send settle

    expect(stub.promptCalls).toHaveLength(1);
    expect(stub.promptCalls[0]).toMatchObject({
      path: { id: 'oc-1' },
      query: { directory: '/repo' },
      body: { parts: [{ type: 'text', text: 'do the thing' }] },
    });
    // No model configured → body must not pin a model (opencode uses its default).
    expect((stub.promptCalls[0] as { body: Record<string, unknown> }).body.model).toBeUndefined();
  });

  it('includes the configured model in the prompt body when set', async () => {
    const agent = new OpencodeAgent({
      workingDir: '/repo',
      model: { providerID: 'anthropic', modelID: 'claude-sonnet-4-5' },
    });
    agent.start();
    await ready(agent);

    agent.sendMessage('do the thing');
    await new Promise((r) => setTimeout(r, 0));

    expect(stub.promptCalls[0]).toMatchObject({
      body: { model: { providerID: 'anthropic', modelID: 'claude-sonnet-4-5' } },
    });
  });

  it('auto-approves every permission request with "always" when unscoped', async () => {
    const agent = new OpencodeAgent({ workingDir: '/repo' });
    agent.start();
    await ready(agent);

    stub.registered?.({
      type: 'permission.updated',
      properties: { id: 'perm-1', type: 'edit', title: 'Edit /app/x.php', metadata: { filePath: '/app/x.php' }, sessionID: 'oc-1' },
    } as unknown as Event);
    await new Promise((r) => setTimeout(r, 0));

    expect(stub.permissionReplies).toEqual([{ permissionID: 'perm-1', response: 'always' }]);
  });

  it('write scope: approves in-scope writes with "once" and rejects out-of-scope ones', async () => {
    const agent = new OpencodeAgent({ workingDir: '/ai-agent-ux', writeScopeDirs: ['/ai-agent-ux', '/tmp'] });
    agent.start();
    await ready(agent);

    stub.registered?.({
      type: 'permission.updated',
      properties: { id: 'perm-in', type: 'edit', title: 'Edit mockup', metadata: { filePath: '/ai-agent-ux/mockup.html' }, sessionID: 'oc-1' },
    } as unknown as Event);
    stub.registered?.({
      type: 'permission.updated',
      properties: { id: 'perm-out', type: 'edit', title: 'Edit OrderView', metadata: { filePath: '/app/OrderView.vue' }, sessionID: 'oc-1' },
    } as unknown as Event);
    await new Promise((r) => setTimeout(r, 0));

    expect(stub.permissionReplies).toEqual([
      { permissionID: 'perm-in', response: 'once' },
      { permissionID: 'perm-out', response: 'reject' },
    ]);
  });

  it('write scope: handles the opencode 1.17 permission.asked shape (permission/patterns/filepath)', async () => {
    const agent = new OpencodeAgent({ workingDir: '/ai-agent-ux', writeScopeDirs: ['/ai-agent-ux', '/tmp'] });
    agent.start();
    await ready(agent);

    // Verified live against opencode 1.17.13: no `type`/`title`, tool name in
    // `permission`, path in metadata.filepath.
    stub.registered?.({
      type: 'permission.asked',
      properties: {
        id: 'perm-legacy',
        permission: 'edit',
        patterns: ['app/OrderView.vue'],
        metadata: { filepath: '/app/OrderView.vue', diff: 'Index: /app/OrderView.vue' },
        sessionID: 'oc-1',
      },
    } as unknown as Event);
    await new Promise((r) => setTimeout(r, 0));

    expect(stub.permissionReplies).toEqual([{ permissionID: 'perm-legacy', response: 'reject' }]);
  });

  it('registers the in-process MCP tools on start and tears them down on kill', async () => {
    const agent = new OpencodeAgent({
      workingDir: '/repo',
      mcp: {
        platform: { type: 'mattermost', url: 'https://mm', token: 't', channelId: 'c', allowedUsers: [] },
        threadId: 'thread-1',
        allowedRoots: ['/repo'],
        outboundEnabled: true,
        maxBytes: 0,
        sessionOwnerUsername: 'alice',
        promptTimeoutMs: 1000,
      },
    });
    agent.start();
    await ready(agent);

    // Registered with the host + told opencode about the remote MCP.
    expect(stub.hostRegistered).toBe(1);
    expect(stub.mcpAdds).toEqual([{ name: 'claude-threads-oc-1', url: 'http://127.0.0.1:9/mcp/tok' }]);

    await agent.kill();

    // Teardown disconnects the opencode registration and drops the host entry.
    expect(stub.mcpDisconnects).toEqual(['claude-threads-oc-1']);
    expect(stub.hostUnregistered).toEqual(['tok']);
  });

  it('does not register MCP tools when no mcp option is given', async () => {
    const agent = new OpencodeAgent({ workingDir: '/repo' });
    agent.start();
    await ready(agent);

    expect(stub.hostRegistered).toBe(0);
    expect(stub.mcpAdds).toEqual([]);
  });

  it('aborts the session and emits exit once on kill', async () => {
    const agent = new OpencodeAgent({ workingDir: '/repo' });
    let exits = 0;
    agent.on('exit', () => exits++);
    agent.start();
    await ready(agent);

    await agent.kill();
    await agent.kill(); // idempotent

    expect(stub.stopped).toEqual(['oc-1']); // its own stream was stopped, once
    expect(stub.abortCalls).toHaveLength(1);
    expect(exits).toBe(1);
    expect(agent.isRunning()).toBe(false);
  });

  it('surfaces a session-create failure as error + exit + permanent failure', async () => {
    stub.createResult = { error: { message: 'no provider configured' } };
    const agent = new OpencodeAgent({ workingDir: '/repo' });
    const errors: Error[] = [];
    let exits = 0;
    agent.on('error', (e: Error) => errors.push(e));
    agent.on('exit', () => exits++);
    agent.start();
    await ready(agent).catch(() => {}); // ready rejects on failure

    expect(errors).toHaveLength(1);
    expect(exits).toBe(1);
    expect(agent.isPermanentFailure()).toBe(true);
    expect(agent.getPermanentFailureReason()).toContain('could not be started');
  });
});

describe('parseOpencodeModel', () => {
  it('splits provider/model on the first slash', () => {
    expect(parseOpencodeModel('anthropic/claude-sonnet-4-5')).toEqual({
      providerID: 'anthropic',
      modelID: 'claude-sonnet-4-5',
    });
  });

  it('keeps remaining slashes in the model id (openrouter-style nested ids)', () => {
    expect(parseOpencodeModel('openrouter/anthropic/claude-3.5-sonnet')).toEqual({
      providerID: 'openrouter',
      modelID: 'anthropic/claude-3.5-sonnet',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(parseOpencodeModel('  openai/gpt-5  ')).toEqual({ providerID: 'openai', modelID: 'gpt-5' });
  });

  it('returns undefined for empty/omitted or non provider/model specs', () => {
    expect(parseOpencodeModel(undefined)).toBeUndefined();
    expect(parseOpencodeModel('')).toBeUndefined();
    expect(parseOpencodeModel('sonnet')).toBeUndefined();      // no slash → no provider
    expect(parseOpencodeModel('/claude')).toBeUndefined();     // empty provider
    expect(parseOpencodeModel('anthropic/')).toBeUndefined();  // empty model id
  });
});
