import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openSecret, sealSecret } from '../server/utils/secret-box.ts';

test('a sealed secret opens with the same signing key', () => {
    const box = sealSecret('signing-key', 'sk-123');
    assert.notEqual(box.includes('sk-123'), true);
    assert.equal(openSecret('signing-key', box), 'sk-123');
});

test('another signing key or a damaged box opens nothing', () => {
    const box = sealSecret('signing-key', 'sk-123');
    assert.equal(openSecret('other-key', box), null);
    const [iv, tag, sealed] = box.split('.');
    const flipped = `${sealed![0] === 'A' ? 'B' : 'A'}${sealed!.slice(1)}`;
    assert.equal(openSecret('signing-key', [iv, tag, flipped].join('.')), null);
    assert.equal(openSecret('signing-key', 'garbage'), null);
});
