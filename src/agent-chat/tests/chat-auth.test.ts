import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNonceLedger, createSessionValue, createSignInParams, isChatKey, redeemSignIn, sessionUserId } from '../server/utils/chat-auth.ts';

const KEY = 'test-key';
const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

test('a signed link signs in once with its name and picture', () => {
    const ledger = createNonceLedger();
    const params = createSignInParams(KEY, { name: 'Jonas Ä', avatarUrl: 'https://app.test/a.png' }, NOW);
    assert.deepEqual(redeemSignIn(KEY, params, ledger, NOW), { name: 'Jonas Ä', avatarUrl: 'https://app.test/a.png' });
    assert.equal(redeemSignIn(KEY, params, ledger, NOW), null);
});

test('a link without a picture signs in with none', () => {
    const params = createSignInParams(KEY, { name: 'Jonas', avatarUrl: null }, NOW);
    assert.deepEqual(redeemSignIn(KEY, params, createNonceLedger(), NOW), { name: 'Jonas', avatarUrl: null });
});

test('an expired link is refused', () => {
    const params = createSignInParams(KEY, { name: 'Jonas', avatarUrl: null }, NOW);
    assert.equal(redeemSignIn(KEY, params, createNonceLedger(), NOW + 61_000), null);
    assert.ok(redeemSignIn(KEY, params, createNonceLedger(), NOW + 59_000));
});

test('a changed name, picture, expiry or another key breaks the signature', () => {
    const params = createSignInParams(KEY, { name: 'Jonas', avatarUrl: null }, NOW);
    const other = createSignInParams(KEY, { name: 'Dana', avatarUrl: null }, NOW);
    assert.equal(redeemSignIn(KEY, { ...params, n: other.n }, createNonceLedger(), NOW), null);
    assert.equal(redeemSignIn(KEY, { ...params, a: other.n }, createNonceLedger(), NOW), null);
    assert.equal(redeemSignIn(KEY, { ...params, exp: String(Number(params.exp) + 3600) }, createNonceLedger(), NOW), null);
    assert.equal(redeemSignIn('other-key', params, createNonceLedger(), NOW), null);
    assert.equal(redeemSignIn('', params, createNonceLedger(), NOW), null);
});

test('incomplete parameters are refused', () => {
    const { sig: _sig, ...unsigned } = createSignInParams(KEY, { name: 'Jonas', avatarUrl: null }, NOW);
    assert.equal(redeemSignIn(KEY, unsigned, createNonceLedger(), NOW), null);
    assert.equal(redeemSignIn(KEY, {}, createNonceLedger(), NOW), null);
});

test('a session holds until the key changes and cannot be forged for another person', () => {
    const value = createSessionValue(KEY, 'user-1');
    assert.equal(sessionUserId(KEY, value), 'user-1');
    assert.equal(sessionUserId('new-key', value), null);
    assert.equal(sessionUserId(KEY, value.replace('user-1', 'user-2')), null);
    assert.equal(sessionUserId(KEY, 'user-1'), null);
    assert.equal(sessionUserId(KEY, undefined), null);
    assert.equal(sessionUserId('', value), null);
});

test('only the exact key opens the link endpoint', () => {
    assert.equal(isChatKey(KEY, KEY), true);
    assert.equal(isChatKey(KEY, 'test-kex'), false);
    assert.equal(isChatKey(KEY, ''), false);
    assert.equal(isChatKey('', ''), false);
});
