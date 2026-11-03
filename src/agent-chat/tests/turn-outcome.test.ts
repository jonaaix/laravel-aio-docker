import { test } from 'node:test';
import assert from 'node:assert/strict';
import { afterTurnStep } from '../server/utils/turn-outcome.ts';
import type { AfterTurnState } from '../server/utils/turn-outcome.ts';

function state(overrides: Partial<AfterTurnState<string>> = {}): AfterTurnState<string> {
    return { pausing: false, sessionBusy: false, hasQueued: false, stopped: false, handoffs: 0, handoffLimit: 25, findTarget: () => null, ...overrides };
}

test('an answer that ends the conversation turn notifies', () => {
    assert.deepEqual(afterTurnStep(state()), { action: 'finish', notify: true });
});

test('a stopped answer ends the turn without a notification and without looking for a hand-over', () => {
    let looked = 0;
    const step = afterTurnStep(state({ stopped: true, findTarget: () => { looked += 1; return 'peter'; } }));
    assert.deepEqual(step, { action: 'finish', notify: false });
    assert.equal(looked, 0);
});

test('a hand-over to another agent does not notify in between', () => {
    assert.deepEqual(afterTurnStep(state({ findTarget: () => 'peter' })), { action: 'handoff', target: 'peter' });
});

test('the last hand-over below the limit still goes through, the limit itself stops with a notification', () => {
    assert.deepEqual(afterTurnStep(state({ handoffs: 24, findTarget: () => 'peter' })), { action: 'handoff', target: 'peter' });
    assert.deepEqual(afterTurnStep(state({ handoffs: 25, findTarget: () => 'peter' })), { action: 'limit', notify: true });
});

test('a queued message goes first, without a notification and without looking for a hand-over', () => {
    let looked = 0;
    const step = afterTurnStep(state({ hasQueued: true, findTarget: () => { looked += 1; return 'peter'; } }));
    assert.deepEqual(step, { action: 'next-queued' });
    assert.equal(looked, 0);
});

test('while pausing or while the same agent is still working nothing happens', () => {
    assert.deepEqual(afterTurnStep(state({ pausing: true, hasQueued: true })), { action: 'wait' });
    assert.deepEqual(afterTurnStep(state({ sessionBusy: true, findTarget: () => 'peter' })), { action: 'wait' });
});

test('a stopped answer with a queued message still moves on to the queue', () => {
    assert.deepEqual(afterTurnStep(state({ stopped: true, hasQueued: true })), { action: 'next-queued' });
});
