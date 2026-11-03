import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMembershipFlag } from '../server/utils/membership-flag.ts';

test('only a real true or false is a membership flag', () => {
    assert.equal(isMembershipFlag(true), true);
    assert.equal(isMembershipFlag(false), true);
});

test('anything else is refused, including look-alikes and missing values', () => {
    for (const value of ['true', 'false', 1, 0, null, undefined, {}, [], [true]]) {
        assert.equal(isMembershipFlag(value), false, String(value));
    }
});
