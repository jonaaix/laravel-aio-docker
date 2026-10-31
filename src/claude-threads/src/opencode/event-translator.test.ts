/**
 * Tests for the opencode → Claude event translator.
 *
 * Two layers:
 *  1. Direct assertions on the Claude-shaped events the translator emits
 *     (dedup, completion gating, tool/title mapping, todo mapping, usage).
 *  2. Integration: pipe the translated events through the REAL `transformEvent`
 *     to prove the output is actually consumable by the downstream pipeline
 *     (text → AppendContentOp, todos → TaskListOp, idle → Flush + StatusUpdate).
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type { Event } from '@opencode-ai/sdk';
import { OpencodeEventTranslator } from './event-translator.js';
import { transformEvent, type TransformContext } from '../operations/transformer.js';
import type { AgentEvent } from '../agent/backend.js';
import type { PlatformFormatter } from '../platform/formatter.js';

// ---------------------------------------------------------------------------
// opencode event builders (cast; tests only need the fields the translator reads)
// ---------------------------------------------------------------------------

const oc = (v: unknown): Event => v as Event;

function textPart(id: string, text: string, opts: { end?: number; delta?: string } = {}): Event {
  return oc({
    type: 'message.part.updated',
    properties: {
      part: {
        id,
        sessionID: 's',
        messageID: 'm',
        type: 'text',
        text,
        time: opts.end !== undefined ? { start: 0, end: opts.end } : { start: 0 },
      },
      delta: opts.delta,
    },
  });
}

function reasoningPart(id: string, text: string, opts: { end?: number } = {}): Event {
  return oc({
    type: 'message.part.updated',
    properties: {
      part: {
        id,
        sessionID: 's',
        messageID: 'm',
        type: 'reasoning',
        text,
        time: opts.end !== undefined ? { start: 0, end: opts.end } : { start: 0 },
      },
    },
  });
}

function toolPart(callID: string, tool: string, state: Record<string, unknown>): Event {
  return oc({
    type: 'message.part.updated',
    properties: {
      part: { id: `part-${callID}`, sessionID: 's', messageID: 'm', type: 'tool', callID, tool, state },
    },
  });
}

function todoUpdated(todos: Array<{ content: string; status: string; priority?: string; id?: string }>): Event {
  return oc({
    type: 'todo.updated',
    properties: {
      sessionID: 's',
      todos: todos.map((t, i) => ({ priority: 'medium', id: String(i), ...t })),
    },
  });
}

function assistantMessage(info: Record<string, unknown>): Event {
  return oc({ type: 'message.updated', properties: { info: { role: 'assistant', ...info } } });
}

function userMessage(id: string): Event {
  return oc({ type: 'message.updated', properties: { info: { role: 'user', id } } });
}

/** Text/reasoning builders default to messageID 'm'; mark it assistant so parts emit. */
const MSG_ID = 'm';

const idle: Event = oc({ type: 'session.idle', properties: { sessionID: 's' } });

// Small typed accessors for the loose AgentEvent shape.
const firstBlock = (e: AgentEvent): Record<string, unknown> =>
  ((e as { message?: { content?: Array<Record<string, unknown>> } }).message?.content?.[0]) ?? {};
const toolUse = (e: AgentEvent) => (e as { tool_use?: Record<string, unknown> }).tool_use ?? {};
const toolResult = (e: AgentEvent) => (e as { tool_result?: Record<string, unknown> }).tool_result ?? {};

describe('OpencodeEventTranslator', () => {
  let t: OpencodeEventTranslator;
  beforeEach(() => {
    t = new OpencodeEventTranslator();
  });

  // -------------------------------------------------------------------------
  // Text streaming: dedup + completion gating
  // -------------------------------------------------------------------------

  it('does not emit a text part until it completes (time.end)', () => {
    expect(t.translate(textPart('p1', 'Hel', { delta: 'Hel' }))).toEqual([]);
    expect(t.translate(textPart('p1', 'Hello', { delta: 'lo' }))).toEqual([]);
  });

  it('emits a completed text part exactly once', () => {
    t.translate(assistantMessage({ id: MSG_ID }));
    t.translate(textPart('p1', 'Hello', { delta: 'Hello' }));
    const out = t.translate(textPart('p1', 'Hello world', { end: 5 }));
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('assistant');
    expect(firstBlock(out[0])).toEqual({ type: 'text', text: 'Hello world' });

    // A later update for the same (already emitted) part must not re-emit.
    expect(t.translate(textPart('p1', 'Hello world', { end: 5 }))).toEqual([]);
  });

  it('flushes an unfinished text part at session.idle (backstop) — once', () => {
    t.translate(assistantMessage({ id: MSG_ID }));
    t.translate(textPart('p1', 'dangling text', { delta: 'dangling text' }));
    const out = t.translate(idle);
    // assistant text first, then the result event
    expect(out[0].type).toBe('assistant');
    expect(firstBlock(out[0])).toEqual({ type: 'text', text: 'dangling text' });
    expect(out[out.length - 1].type).toBe('result');

    // Idle again: text already flushed, only a result remains.
    const out2 = t.translate(idle);
    expect(out2.every((e) => e.type !== 'assistant')).toBe(true);
  });

  it('does not emit empty/whitespace-only text parts', () => {
    t.translate(assistantMessage({ id: MSG_ID }));
    const out = t.translate(textPart('p1', '   ', { end: 1 }));
    expect(out).toEqual([]);
  });

  it('does NOT surface reasoning parts (parity with Claude, which never shows reasoning)', () => {
    t.translate(assistantMessage({ id: MSG_ID }));
    const out = t.translate(reasoningPart('r1', 'pondering', { end: 3 }));
    expect(out).toEqual([]);
  });

  it('never echoes a user-message text part back as assistant text', () => {
    // Regression: opencode streams the user's own prompt as message.part.updated
    // on the user message. Those must not be surfaced as assistant output.
    t.translate(userMessage('u1'));
    const out = t.translate(
      oc({
        type: 'message.part.updated',
        properties: {
          part: { id: 'up1', sessionID: 's', messageID: 'u1', type: 'text', text: 'my prompt', time: { start: 0, end: 1 } },
        },
      }),
    );
    expect(out).toEqual([]);
    // …and the idle backstop must not resurrect it either.
    expect(t.translate(idle).every((e) => e.type !== 'assistant')).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Tools
  // -------------------------------------------------------------------------

  it('emits tool_use with opencode title as the name when running', () => {
    const out = t.translate(
      toolPart('c1', 'bash', { status: 'running', input: { command: 'ls' }, title: 'Run ls', time: { start: 0 } }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('tool_use');
    expect(toolUse(out[0])).toMatchObject({ id: 'c1', name: 'Run ls', input: { command: 'ls' } });
  });

  it('falls back to a title-cased tool name when no title is present', () => {
    const out = t.translate(toolPart('c1', 'bash', { status: 'running', input: {}, time: { start: 0 } }));
    expect(toolUse(out[0]).name).toBe('Bash');
  });

  it('rewrites our namespaced MCP tools to the canonical Claude name (so the formatters match)', () => {
    // opencode surfaces `claude-threads-<sessionId>_<tool>` (sessionId itself
    // contains `_`); the shared formatters key on mcp__claude-threads-mcp__*.
    // Without the rewrite, react_to_post isn't hidden and the raw namespaced
    // name leaks into the working block.
    const react = t.translate(
      toolPart('c1', 'claude-threads-ses_080050226ffe0dJgtou8yz_react_to_post', { status: 'running', input: {}, time: { start: 0 } }),
    );
    expect(toolUse(react[0]).name).toBe('mcp__claude-threads-mcp__react_to_post');

    const send = t.translate(
      toolPart('c2', 'claude-threads-ses_080050226ffe0dJgtou8yz_send_file', { status: 'running', input: {}, time: { start: 0 } }),
    );
    expect(toolUse(send[0]).name).toBe('mcp__claude-threads-mcp__send_file');
  });

  it('leaves non-claude-threads tool names untouched', () => {
    const out = t.translate(
      toolPart('c1', 'some-other-mcp_do_thing', { status: 'running', input: {}, time: { start: 0 } }),
    );
    expect(toolUse(out[0]).name).toBe('Some-other-mcp_do_thing');
  });

  it('aliases opencode camelCase input fields to the snake_case the formatters read', () => {
    // Regression: opencode read/write/edit put the path in `filePath`, but the
    // Claude file-tool formatter reads `file_path` → the path rendered as empty
    // backticks (`📄 Read \`\``). The alias is added, the original kept.
    const out = t.translate(
      toolPart('c1', 'read', { status: 'running', input: { filePath: '/tmp/x/image.png' }, time: { start: 0 } }),
    );
    const input = toolUse(out[0]).input as Record<string, unknown>;
    expect(input.file_path).toBe('/tmp/x/image.png');
    expect(input.filePath).toBe('/tmp/x/image.png'); // original preserved
  });

  it('aliases edit oldString/newString so the diff renders', () => {
    const out = t.translate(
      toolPart('c1', 'edit', {
        status: 'running',
        input: { filePath: '/p/a.ts', oldString: 'foo', newString: 'bar' },
        time: { start: 0 },
      }),
    );
    const input = toolUse(out[0]).input as Record<string, unknown>;
    expect(input).toMatchObject({ file_path: '/p/a.ts', old_string: 'foo', new_string: 'bar' });
  });

  it('leaves already-matching field names (pattern/command/content) untouched', () => {
    const out = t.translate(
      toolPart('c1', 'grep', { status: 'running', input: { pattern: 'TODO' }, time: { start: 0 } }),
    );
    expect((toolUse(out[0]).input as Record<string, unknown>).pattern).toBe('TODO');
  });

  it('emits tool_use once, then tool_result on completion (no duplicate tool_use)', () => {
    t.translate(toolPart('c1', 'read', { status: 'running', input: {}, title: 'Read a.ts', time: { start: 0 } }));
    const done = t.translate(
      toolPart('c1', 'read', { status: 'completed', input: {}, output: 'ok', title: 'Read a.ts', metadata: {}, time: { start: 0, end: 9 } }),
    );
    expect(done).toHaveLength(1);
    expect(done[0].type).toBe('tool_result');
    expect(toolResult(done[0])).toEqual({ tool_use_id: 'c1', is_error: false });
  });

  it('emits tool_use + tool_result together when a tool arrives already completed', () => {
    const out = t.translate(
      toolPart('c9', 'read', { status: 'completed', input: {}, output: 'ok', title: 'Read', metadata: {}, time: { start: 0, end: 1 } }),
    );
    expect(out.map((e) => e.type)).toEqual(['tool_use', 'tool_result']);
  });

  it('marks tool_result as error for a failed tool', () => {
    t.translate(toolPart('c1', 'bash', { status: 'running', input: {}, title: 'x', time: { start: 0 } }));
    const out = t.translate(toolPart('c1', 'bash', { status: 'error', input: {}, error: 'boom', time: { start: 0, end: 2 } }));
    expect(toolResult(out[0])).toEqual({ tool_use_id: 'c1', is_error: true });
  });

  it('suppresses the todo tool as a tool row (todo.updated owns the list)', () => {
    expect(
      t.translate(toolPart('c1', 'todowrite', { status: 'running', input: {}, title: 'Update todos', time: { start: 0 } })),
    ).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Todos
  // -------------------------------------------------------------------------

  it('translates todo.updated into a TodoWrite tool_use with activeForm + cancelled→completed', () => {
    const out = t.translate(
      todoUpdated([
        { content: 'do A', status: 'in_progress' },
        { content: 'do B', status: 'cancelled' },
      ]),
    );
    expect(out).toHaveLength(1);
    expect(toolUse(out[0]).name).toBe('TodoWrite');
    expect(toolUse(out[0]).input).toEqual({
      todos: [
        { content: 'do A', status: 'in_progress', activeForm: 'do A' },
        { content: 'do B', status: 'completed', activeForm: 'do B' },
      ],
    });
  });

  // -------------------------------------------------------------------------
  // Usage / result
  // -------------------------------------------------------------------------

  it('carries the last assistant message usage into the result event at idle', () => {
    t.translate(
      assistantMessage({
        modelID: 'claude-sonnet-4',
        cost: 0.42,
        tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 10, write: 5 } },
      }),
    );
    const out = t.translate(idle);
    const result = out.find((e) => e.type === 'result') as AgentEvent & { result?: Record<string, unknown> };
    expect(result.result).toMatchObject({
      model: 'claude-sonnet-4',
      cost_usd: 0.42,
      usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, cache_creation_input_tokens: 5 },
    });
  });

  it('emits a ⚠️ assistant message and an error result on session.error', () => {
    const out = t.translate(
      oc({ type: 'session.error', properties: { error: { name: 'ProviderAuthError', data: { message: 'no auth' } } } }),
    );
    expect(firstBlock(out[0])).toEqual({ type: 'text', text: '⚠️ no auth' });
    const result = out[out.length - 1] as AgentEvent & { is_error?: boolean };
    expect(result.type).toBe('result');
    expect(result.is_error).toBe(true);
  });

  it('suppresses a stray session.idle after the turn was already closed (abort burst)', () => {
    // Observed on abort: session.error, then session.idle 2ms later with no
    // activity in between — the second turn-end must NOT emit another result
    // (each result triggers a full flush/status cycle downstream).
    t.translate(assistantMessage({ id: MSG_ID }));
    t.translate(oc({ type: 'session.error', properties: { error: { name: 'AbortedError', data: { message: 'Aborted' } } } }));

    expect(t.translate(idle)).toEqual([]);

    // New activity (the aborted tool parts finalizing late) re-opens the turn,
    // so the NEXT idle closes it with a result again.
    t.translate(toolPart('c9', 'read', { status: 'running', input: {}, title: 'read' }));
    t.translate(toolPart('c9', 'read', { status: 'error', input: {}, title: 'read', error: 'aborted' }));
    const out = t.translate(idle);
    expect(out[out.length - 1].type).toBe('result');

    // And a second bare idle right after is again suppressed.
    expect(t.translate(idle)).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Integration through the real transformer
  // -------------------------------------------------------------------------

  describe('feeding transformEvent', () => {
    const mockFormatter = {
      formatBold: (s: string) => `**${s}**`,
      formatItalic: (s: string) => `_${s}_`,
      formatCode: (s: string) => `\`${s}\``,
      formatCodeBlock: (s: string) => `\`\`\`\n${s}\n\`\`\``,
      formatLink: (s: string, u: string) => `[${s}](${u})`,
      formatStrikethrough: (s: string) => `~~${s}~~`,
      formatMarkdown: (s: string) => s,
      formatUserMention: (s: string) => `@${s}`,
      formatHorizontalRule: () => '---',
      formatBlockquote: (s: string) => `> ${s}`,
      formatListItem: (s: string) => `- ${s}`,
      formatNumberedListItem: (n: number, s: string) => `${n}. ${s}`,
      formatHeading: (s: string) => `# ${s}`,
      escapeText: (s: string) => s,
      formatTable: () => '',
      formatKeyValueList: () => '',
    } as unknown as PlatformFormatter;

    let ctx: TransformContext;
    beforeEach(() => {
      ctx = { sessionId: 'sess', formatter: mockFormatter, toolStartTimes: new Map(), detailed: true };
    });

    const pipe = (events: AgentEvent[]) => events.flatMap((e) => transformEvent(e, ctx));

    it('a completed text part becomes an AppendContentOp with the text', () => {
      t.translate(assistantMessage({ id: MSG_ID }));
      const translated = t.translate(textPart('p1', 'Hello world', { end: 5 }));
      const ops = pipe(translated);
      const append = ops.find((o) => o.type === 'append_content') as { content?: string } | undefined;
      expect(append?.content).toBe('Hello world');
    });

    it('todo.updated becomes a TaskListOp with the mapped tasks', () => {
      const translated = t.translate(todoUpdated([{ content: 'task one', status: 'in_progress' }]));
      const ops = pipe(translated);
      const taskOp = ops.find((o) => o.type === 'task_list') as { tasks?: Array<{ content: string }> } | undefined;
      expect(taskOp?.tasks?.[0]?.content).toBe('task one');
    });

    it('idle produces a flush and a status update through the transformer', () => {
      t.translate(assistantMessage({ modelID: 'm1', cost: 1, tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } } }));
      const ops = pipe(t.translate(idle));
      expect(ops.some((o) => o.type === 'flush')).toBe(true);
      expect(ops.some((o) => o.type === 'status_update')).toBe(true);
    });

    it('a react_to_post tool call produces NO display op (hidden, like the Claude backend)', () => {
      const translated = t.translate(
        toolPart('c1', 'claude-threads-ses_08abc_react_to_post', { status: 'running', input: {}, time: { start: 0 } }),
      );
      const ops = pipe(translated);
      expect(ops.some((o) => o.type === 'append_content')).toBe(false);
    });

    it('a send_file tool call renders as the clean MCP label (not the namespaced name)', () => {
      const translated = t.translate(
        toolPart('c2', 'claude-threads-ses_08abc_send_file', { status: 'running', input: {}, time: { start: 0 } }),
      );
      const append = pipe(translated).find((o) => o.type === 'append_content') as { content?: string } | undefined;
      expect(append?.content).toContain('send_file');
      expect(append?.content).not.toContain('claude-threads-ses_');
    });
  });
});
