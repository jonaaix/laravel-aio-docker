import { describe, test, expect } from 'bun:test';
import {
  parseChannelIds,
  expandPlatformChannels,
  belongsToConnection,
  SUBPLATFORM_SEP,
} from './channels.js';
import type { PlatformInstanceConfig } from './types.js';

describe('parseChannelIds', () => {
  test('splits on commas and whitespace, trims, de-dupes, preserves order', () => {
    expect(parseChannelIds('a, b ,c')).toEqual(['a', 'b', 'c']);
    expect(parseChannelIds('a b\nc')).toEqual(['a', 'b', 'c']);
    expect(parseChannelIds('a, a, b')).toEqual(['a', 'b']);
    expect(parseChannelIds('  solo  ')).toEqual(['solo']);
  });
  test('empty / non-string → empty list', () => {
    expect(parseChannelIds('')).toEqual([]);
    expect(parseChannelIds('   ')).toEqual([]);
    expect(parseChannelIds(undefined)).toEqual([]);
  });
});

const base = {
  id: 'mm',
  type: 'mattermost',
  displayName: 'MM',
  botName: 'bot',
  allowedUsers: [],
  permissionMode: 'auto',
  url: 'https://x',
  token: 't',
} as unknown as PlatformInstanceConfig;

describe('expandPlatformChannels', () => {
  test('single channel → unchanged (same id + channelId)', () => {
    const out = expandPlatformChannels({ ...base, channelId: 'c1' } as PlatformInstanceConfig);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('mm');
    expect((out[0] as unknown as { channelId: string }).channelId).toBe('c1');
  });

  test('multi channel → one sub-config per channel with derived id', () => {
    const out = expandPlatformChannels({ ...base, channelId: 'c1, c2, c3' } as PlatformInstanceConfig);
    expect(out.map((p) => p.id)).toEqual([
      `mm${SUBPLATFORM_SEP}c1`,
      `mm${SUBPLATFORM_SEP}c2`,
      `mm${SUBPLATFORM_SEP}c3`,
    ]);
    expect(out.map((p) => (p as unknown as { channelId: string }).channelId)).toEqual(['c1', 'c2', 'c3']);
    // Other fields carry over.
    expect(out[0].botName).toBe('bot');
    expect((out[0] as unknown as { token: string }).token).toBe('t');
  });

  test('single-channel expansion returns the SAME object (no rewrite)', () => {
    const cfg = { ...base, channelId: 'only' } as PlatformInstanceConfig;
    expect(expandPlatformChannels(cfg)[0]).toBe(cfg);
  });
});

describe('belongsToConnection', () => {
  test('matches the base id and its sub-ids, not siblings', () => {
    expect(belongsToConnection('mm', 'mm')).toBe(true);
    expect(belongsToConnection('mm#c1', 'mm')).toBe(true);
    expect(belongsToConnection('mm2', 'mm')).toBe(false);
    expect(belongsToConnection('mm2#c1', 'mm')).toBe(false);
  });
});
