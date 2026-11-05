import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uiBlockFor } from '../server/utils/ui-blocks.ts';

const storePage = (path: string) => ({ url: `pages/${path}`, fileUrl: `files/${path}`, filename: path });
const twoOptions = [{ title: 'Compact list' }, { title: 'Cards', description: 'Roomier' }];

test('variants are lettered in order and keep the recommendation', () => {
    const block = uiBlockFor('show_variants', { path: 'design.html', variants: twoOptions, recommended: 'B)' }, storePage);
    assert.ok(block.kind === 'variants' && block.page.createdAt > 0);
    assert.deepEqual({ ...block, page: { ...block.page, createdAt: 0 } }, {
        kind: 'variants',
        title: null,
        page: { url: 'pages/design.html', fileUrl: 'files/design.html', filename: 'design.html', height: 560, createdAt: 0 },
        options: [{ letter: 'a', title: 'Compact list', description: null }, { letter: 'b', title: 'Cards', description: 'Roomier' }],
        recommended: 'b',
    });
});

test('a page must be an html file', () => {
    assert.throws(() => uiBlockFor('show_page', { path: 'shot.png' }, storePage), /\.html file/);
});

test('a page height outside the range is refused', () => {
    assert.throws(() => uiBlockFor('show_page', { path: 'a.html', height: 5000 }, storePage), /height/);
});

test('a choice needs two to six options', () => {
    assert.throws(() => uiBlockFor('ask_choice', { question: 'Which?', options: [{ title: 'Only' }] }, storePage), /2 to 6/);
});

test('a recommendation must name one of the options', () => {
    assert.throws(() => uiBlockFor('ask_choice', { question: 'Which?', options: twoOptions, recommended: 'c' }, storePage), /one of the letters a, b/);
});

test('an option without a title is refused', () => {
    assert.throws(() => uiBlockFor('ask_choice', { question: 'Which?', options: [{ title: 'A' }, { description: 'x' }] }, storePage), /options\[1\]\.title is required/);
});

test('cards keep their status and refuse an unknown one', () => {
    assert.deepEqual(uiBlockFor('show_cards', { cards: [{ title: 'API', status: 'good' }] }, storePage), {
        kind: 'cards',
        title: null,
        cards: [{ title: 'API', text: null, status: 'good' }],
    });
    assert.throws(() => uiBlockFor('show_cards', { cards: [{ title: 'API', status: 'green' }] }, storePage), /good, warning, bad/);
});
