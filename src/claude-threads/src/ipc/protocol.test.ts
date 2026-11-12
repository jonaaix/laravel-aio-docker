import { describe, test, expect } from 'bun:test';
import {
  encode,
  LineDecoder,
  reviveServerEvent,
  type ServerEvent,
  type ClientCommand,
} from './protocol.js';

describe('encode', () => {
  test('produces a single newline-terminated JSON line', () => {
    const cmd: ClientCommand = { t: 'toggle:debug', enabled: true };
    const frame = encode(cmd);
    expect(frame.endsWith('\n')).toBe(true);
    expect(frame.indexOf('\n')).toBe(frame.length - 1);
    expect(JSON.parse(frame)).toEqual(cmd);
  });
});

describe('LineDecoder', () => {
  function collect(chunks: string[]): unknown[] {
    const dec = new LineDecoder();
    const out: unknown[] = [];
    for (const c of chunks) dec.push(c, (obj) => out.push(obj));
    return out;
  }

  test('parses one complete line', () => {
    expect(collect(['{"t":"ready"}\n'])).toEqual([{ t: 'ready' }]);
  });

  test('reassembles a message split across chunks', () => {
    expect(collect(['{"t":"re', 'ady"}\n'])).toEqual([{ t: 'ready' }]);
  });

  test('parses multiple messages in one chunk', () => {
    expect(collect(['{"t":"ready"}\n{"t":"shuttingDown"}\n'])).toEqual([
      { t: 'ready' },
      { t: 'shuttingDown' },
    ]);
  });

  test('retains a trailing partial line until completed', () => {
    const dec = new LineDecoder();
    const out: unknown[] = [];
    dec.push('{"t":"ready"}\n{"t":"shut', (o) => out.push(o));
    expect(out).toEqual([{ t: 'ready' }]);
    dec.push('tingDown"}\n', (o) => out.push(o));
    expect(out).toEqual([{ t: 'ready' }, { t: 'shuttingDown' }]);
  });

  test('skips a malformed line but still parses the next good one', () => {
    expect(collect(['not json\n{"t":"ready"}\n'])).toEqual([{ t: 'ready' }]);
  });

  test('ignores blank lines', () => {
    expect(collect(['\n\n{"t":"ready"}\n'])).toEqual([{ t: 'ready' }]);
  });
});

describe('reviveServerEvent', () => {
  test('revives Date fields inside a snapshot', () => {
    const ts = '2026-07-21T10:00:00.000Z';
    const wire = {
      t: 'snapshot',
      snapshot: {
        config: {},
        toggles: {},
        sessions: [{ id: 's1', lastActivity: ts }],
        logs: [{ id: 'l1', timestamp: ts, level: 'info', component: 'x', message: 'm' }],
        update: { status: 'scheduled', currentVersion: '1', scheduledRestartAt: ts },
        ready: true,
        shuttingDown: false,
      },
    };
    const ev = reviveServerEvent(JSON.parse(JSON.stringify(wire))) as Extract<
      ServerEvent,
      { t: 'snapshot' }
    >;
    expect(ev.snapshot.sessions[0].lastActivity).toBeInstanceOf(Date);
    expect(ev.snapshot.logs[0].timestamp).toBeInstanceOf(Date);
    expect(ev.snapshot.update?.scheduledRestartAt).toBeInstanceOf(Date);
    expect((ev.snapshot.logs[0].timestamp as Date).toISOString()).toBe(ts);
  });

  test('revives a standalone log event timestamp', () => {
    const ts = '2026-07-21T10:00:00.000Z';
    const ev = reviveServerEvent({
      t: 'log',
      entry: { id: 'l1', timestamp: ts, level: 'info', component: 'x', message: 'm' },
    }) as Extract<ServerEvent, { t: 'log' }>;
    expect(ev.entry.timestamp).toBeInstanceOf(Date);
  });

  test('leaves non-date events untouched', () => {
    const ev = reviveServerEvent({ t: 'session:remove', sessionId: 's1' });
    expect(ev).toEqual({ t: 'session:remove', sessionId: 's1' });
  });
});
