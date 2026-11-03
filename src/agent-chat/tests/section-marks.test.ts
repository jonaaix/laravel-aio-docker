import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasUnbarredSection } from '../shared/utils/section-marks.ts';

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
