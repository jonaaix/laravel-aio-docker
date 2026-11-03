import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAppVisible, setAppVisible } from '../server/utils/push-presence.ts';

const NOW = 1_000_000;

test('an app reported visible counts as visible until its heartbeat runs out', () => {
    setAppVisible('e1', 'u1', true, NOW);
    assert.equal(isAppVisible('e1', 'u1', NOW + 49_000), true);
    assert.equal(isAppVisible('e1', 'u1', NOW + 51_000), false);
});

test('reporting the app hidden clears the presence at once', () => {
    setAppVisible('e2', 'u1', true, NOW);
    setAppVisible('e2', 'u1', false, NOW + 1);
    assert.equal(isAppVisible('e2', 'u1', NOW + 2), false);
});

test('presence belongs to one device and one person', () => {
    setAppVisible('e3', 'u1', true, NOW);
    assert.equal(isAppVisible('e3', 'u2', NOW), false);
    assert.equal(isAppVisible('other', 'u1', NOW), false);
});

test('a new heartbeat extends the presence', () => {
    setAppVisible('e4', 'u1', true, NOW);
    setAppVisible('e4', 'u1', true, NOW + 40_000);
    assert.equal(isAppVisible('e4', 'u1', NOW + 80_000), true);
});
