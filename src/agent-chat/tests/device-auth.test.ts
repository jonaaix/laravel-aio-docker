import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { accessTokenDeviceId, createAccessToken, createChallenges, createPairingCodes, isDeviceSignature, readDevicePublicKey, ACCESS_TOKEN_LIFETIME_MS, PAIRING_CODE_LIFETIME_MS } from '../server/utils/device-auth.ts';

const KEY = 'test-key';
const NOW = Date.UTC(2026, 10, 3, 12, 0, 0);

async function browserDevice() {
    const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
    const jwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey);
    return {
        publicKey: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
        async sign(challenge: string): Promise<string> {
            const signature = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(challenge));
            return Buffer.from(signature).toString('base64url');
        },
    };
}

test('a pairing code pairs once and only within ten minutes', () => {
    const codes = createPairingCodes();
    const { code } = codes.issue('user-1', NOW);
    assert.equal(codes.claim(code, NOW + 1000), 'user-1');
    assert.equal(codes.claim(code, NOW + 2000), null);
    const late = codes.issue('user-1', NOW);
    assert.equal(codes.claim(late.code, NOW + PAIRING_CODE_LIFETIME_MS + 1), null);
    assert.equal(codes.claim(undefined, NOW), null);
});

test('a browser-made key signs a challenge the server accepts, once', async () => {
    const device = await browserDevice();
    const key = readDevicePublicKey(device.publicKey);
    assert.ok(key);
    const challenges = createChallenges();
    const challenge = challenges.issue('device-1', NOW);
    const signature = await device.sign(challenge);
    assert.equal(isDeviceSignature(key, challenge, signature), true);
    assert.equal(challenges.consume(challenge, 'device-1', NOW), true);
    assert.equal(challenges.consume(challenge, 'device-1', NOW), false);
});

test('another device cannot use a challenge or a signature that is not its own', async () => {
    const device = await browserDevice();
    const other = await browserDevice();
    const challenges = createChallenges();
    const challenge = challenges.issue('device-1', NOW);
    assert.equal(isDeviceSignature(readDevicePublicKey(device.publicKey)!, challenge, await other.sign(challenge)), false);
    assert.equal(isDeviceSignature(readDevicePublicKey(device.publicKey)!, `${challenge}x`, await device.sign(challenge)), false);
    assert.equal(challenges.consume(challenge, 'device-2', NOW), false);
});

test('only public P-256 keys are accepted, never a private one', async () => {
    const device = await browserDevice();
    assert.equal(readDevicePublicKey({ ...device.publicKey, d: 'secret' }), null);
    assert.equal(readDevicePublicKey({ ...device.publicKey, crv: 'P-384' }), null);
    assert.equal(readDevicePublicKey({ ...device.publicKey, x: 'AAAA' }), null);
    assert.equal(readDevicePublicKey(null), null);
});

test('an access token names its device for fifteen minutes and cannot be forged', () => {
    const { token } = createAccessToken(KEY, 'device-1', NOW);
    assert.equal(accessTokenDeviceId(KEY, token, NOW + 1000), 'device-1');
    assert.equal(accessTokenDeviceId(KEY, token, NOW + ACCESS_TOKEN_LIFETIME_MS + 1), null);
    assert.equal(accessTokenDeviceId('new-key', token, NOW), null);
    assert.equal(accessTokenDeviceId(KEY, token.replace('device-1', 'device-2'), NOW), null);
    assert.equal(accessTokenDeviceId(KEY, undefined, NOW), null);
});
