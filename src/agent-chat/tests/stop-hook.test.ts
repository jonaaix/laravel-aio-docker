import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STOP_HOOK_PART, isStopHookMark, partsBeforeStopHook } from '../shared/utils/stop-hook.ts';
import type { ChatPart } from '../shared/types/conversation.ts';

const answer: ChatPart = { type: 'text', text: 'Done.', state: 'done' };
const hookReply: ChatPart = { type: 'text', text: '✅ Code check ok.', state: 'done' };

test('everything after the stop hook mark is left out of the answer', () => {
    assert.deepEqual(partsBeforeStopHook([answer, { ...STOP_HOOK_PART }, hookReply]), [answer]);
});

test('an answer without a stop hook stays whole', () => {
    assert.deepEqual(partsBeforeStopHook([answer, hookReply]), [answer, hookReply]);
});

test('only the mark counts as a stop hook', () => {
    assert.equal(isStopHookMark({ ...STOP_HOOK_PART }), true);
    assert.equal(isStopHookMark(answer), false);
});
