import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasUnbarredSection, markerHeading } from '../shared/utils/section-marks.ts';

const BAR = '╌'.repeat(20);

test('a marked section between bars needs no reminder', () => {
    assert.equal(hasUnbarredSection(`Done.\n\n${BAR}\n🔑 TL;DR\n${BAR}\nAll good.`), false);
});

test('a marked section title on its own line without bars is caught', () => {
    assert.equal(hasUnbarredSection('Done.\n\n🔑 TL;DR\n- All good.'), true);
    assert.equal(hasUnbarredSection('Done.\n\n## ❓ Questions\n\n1. Which?'), true);
    assert.equal(hasUnbarredSection(`Done.\n\n${BAR}\n🚀 Next\nShip it.`), true);
});

test('marks inside sentences or list items are left alone', () => {
    assert.equal(hasUnbarredSection('Done.\n- 🔑 TL;DR is below'), false);
    assert.equal(hasUnbarredSection('The 🚀 launch went fine and everything kept running as planned for the whole afternoon.'), false);
    assert.equal(hasUnbarredSection('Plain answer without any sections.'), false);
});

test('a marker with its text after a colon is a heading of its own', () => {
    assert.deepEqual(markerHeading(['🚀 Next: Soll ich Rust installieren, damit ich das Projekt kompiliere?'], 0), { title: '🚀 Next', text: 'Soll ich Rust installieren, damit ich das Projekt kompiliere?' });
    assert.deepEqual(markerHeading(['**🔑 TL;DR:** Alles gut.'], 0), { title: '🔑 TL;DR', text: 'Alles gut.' });
    assert.deepEqual(markerHeading(['🔑 TL;DR'], 0), { title: '🔑 TL;DR', text: null });
    assert.equal(markerHeading(['Done.', '🚀 Next: Ship it.'], 1), null);
});
