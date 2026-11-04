import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatNames } from '../shared/utils/user-name.ts';

test('a unique first name stands alone', () => {
    assert.deepEqual(chatNames([{ id: 'a', name: 'Jonas Gnioui' }, { id: 'b', name: 'Mira Klein' }]), { a: 'Jonas', b: 'Mira' });
});

test('a shared first name takes the initial of the last name', () => {
    assert.deepEqual(chatNames([{ id: 'a', name: 'Jonas Gnioui' }, { id: 'b', name: 'jonas müller' }]), { a: 'Jonas G.', b: 'jonas M.' });
});

test('a name without a last name stays as it is', () => {
    assert.deepEqual(chatNames([{ id: 'a', name: 'Claude' }, { id: 'b', name: 'Claude Two' }]), { a: 'Claude', b: 'Claude T.' });
});

test('the full name is used when first name and initial still match', () => {
    assert.deepEqual(chatNames([{ id: 'a', name: 'Max Meier' }, { id: 'b', name: 'Max Müller' }, { id: 'c', name: 'Max Schulz' }]), { a: 'Max Meier', b: 'Max Müller', c: 'Max S.' });
});

test('middle names are skipped', () => {
    assert.deepEqual(chatNames([{ id: 'a', name: 'Anna Maria Weber' }, { id: 'b', name: 'Anna Schmidt' }]), { a: 'Anna W.', b: 'Anna S.' });
});
