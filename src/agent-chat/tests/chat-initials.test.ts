import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatInitials } from '../app/utils/chat-initials.ts';

test('initials come from the first two words of a chat title', () => {
    assert.equal(chatInitials('Minimales Rust-Klassenbeispiel'), 'MR');
    assert.equal(chatInitials('kannst du mal'), 'KD');
    assert.equal(chatInitials('Ölwechsel'), 'Ö');
    assert.equal(chatInitials('🚀 …'), '#');
});
