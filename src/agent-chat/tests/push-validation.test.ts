import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ENDPOINT_LENGTH, isHubRef, isPushEndpoint, isShortToken, isVapidKeyPair } from '../server/utils/push-validation.ts';

test('the endpoints of the real push services are accepted', () => {
    for (const endpoint of [
        'https://fcm.googleapis.com/fcm/send/abc',
        'https://web.push.apple.com/QOx3',
        'https://updates.push.services.mozilla.com/wpush/v2/abc',
        'https://db5p.notify.windows.com/?token=abc',
    ]) {
        assert.equal(isPushEndpoint(endpoint), true, endpoint);
    }
});

test('any other host is refused, including look-alikes and internal addresses', () => {
    for (const endpoint of [
        'https://example.com/push',
        'https://fcm.googleapis.com.evil.example/x',
        'https://evilfcm.googleapis.com.example.org/x',
        'https://notapple.com/x',
        'https://169.254.169.254/latest/meta-data',
        'https://localhost/x',
        'https://192.168.1.10/x',
        'https://user:pass@fcm.googleapis.com/x',
    ]) {
        assert.equal(isPushEndpoint(endpoint), false, endpoint);
    }
});

test('only https is accepted and the address must be a text of reasonable length', () => {
    assert.equal(isPushEndpoint('http://fcm.googleapis.com/x'), false);
    assert.equal(isPushEndpoint('ftp://fcm.googleapis.com/x'), false);
    assert.equal(isPushEndpoint('not a url'), false);
    assert.equal(isPushEndpoint(undefined), false);
    assert.equal(isPushEndpoint({}), false);
    assert.equal(isPushEndpoint(`https://fcm.googleapis.com/${'a'.repeat(MAX_ENDPOINT_LENGTH)}`), false);
});

test('loopback addresses are only accepted when development allows them', () => {
    assert.equal(isPushEndpoint('https://127.0.0.1:5443/push', true), true);
    assert.equal(isPushEndpoint('https://localhost:5443/push', true), true);
    assert.equal(isPushEndpoint('https://127.0.0.1:5443/push', false), false);
    assert.equal(isPushEndpoint('https://192.168.1.10/x', true), false);
});

test('keys are short non-empty texts', () => {
    assert.equal(isShortToken('abc'), true);
    assert.equal(isShortToken(''), false);
    assert.equal(isShortToken('a'.repeat(300)), false);
    assert.equal(isShortToken(5), false);
});

test('a device key pair needs an uncompressed P-256 point and a 32-byte secret', () => {
    const point = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url');
    const secret = Buffer.alloc(32, 2).toString('base64url');
    assert.equal(isVapidKeyPair({ publicKey: point, privateKey: secret }), true);
    assert.equal(isVapidKeyPair({ publicKey: Buffer.alloc(65, 1).toString('base64url'), privateKey: secret }), false);
    assert.equal(isVapidKeyPair({ publicKey: point, privateKey: Buffer.alloc(31, 2).toString('base64url') }), false);
    assert.equal(isVapidKeyPair({ publicKey: `${point}=`, privateKey: secret }), false);
    assert.equal(isVapidKeyPair(undefined), false);
});

test('a hub reference is a short plain id', () => {
    assert.equal(isHubRef('6f1c2b8e-1a2b-4c3d-9e8f-0a1b2c3d4e5f'), true);
    assert.equal(isHubRef(''), false);
    assert.equal(isHubRef('x'.repeat(65)), false);
    assert.equal(isHubRef('../evil'), false);
    assert.equal(isHubRef(7), false);
});
