import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uiBlockFor } from '../server/utils/ui-blocks.ts';

const storePage = (path: string) => ({ url: `pages/${path}`, fileUrl: `files/${path}`, filename: path });
const twoOptions = [{ title: 'Compact list' }, { title: 'Cards', description: 'Roomier' }];

test('variants are lettered in order, each with its own page, and keep the recommendation', () => {
    const block = uiBlockFor('show_variants', { canvas: 'small', variants: [{ path: 'a.html', title: 'Cards' }, { path: 'b.html', title: 'Table', description: 'Dense' }], recommended: true }, storePage);
    assert.ok(block.kind === 'variants');
    assert.equal(block.columns, 2);
    assert.deepEqual(block.viewport, { width: 1280, height: 800 });
    assert.deepEqual(block.options.map(option => [option.letter, option.title, option.description, option.page.url]), [['a', 'Cards', null, 'pages/a.html'], ['b', 'Table', 'Dense', 'pages/b.html']]);
    assert.equal(block.recommended, 'a');
});

test('variants need a small or large canvas and a page each', () => {
    assert.throws(() => uiBlockFor('show_variants', { canvas: 'huge', variants: [{ path: 'a.html', title: 'A' }, { path: 'b.html', title: 'B' }] }, storePage), /canvas must be small or large/);
    assert.throws(() => uiBlockFor('show_variants', { canvas: 'constructor', variants: [{ path: 'a.html', title: 'A' }, { path: 'b.html', title: 'B' }] }, storePage), /canvas must be small or large/);
    assert.throws(() => uiBlockFor('show_variants', { canvas: 'large', variants: [{ path: 'a.html', title: 'A' }, { title: 'B' }] }, storePage), /variants\[1\]\.path is required/);
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

test('a recommendation is a yes or no for option a', () => {
    assert.equal((uiBlockFor('ask_choice', { question: 'Which?', options: twoOptions }, storePage) as { recommended: string | null }).recommended, null);
    assert.throws(() => uiBlockFor('ask_choice', { question: 'Which?', options: twoOptions, recommended: 'c' }, storePage), /true or false/);
});

test('an option without a title is refused', () => {
    assert.throws(() => uiBlockFor('ask_choice', { question: 'Which?', options: [{ title: 'A' }, { description: 'x' }] }, storePage), /options\[1\]\.title is required/);
});

test('cards keep their status and refuse an unknown one', () => {
    assert.deepEqual(uiBlockFor('show_cards', { cards: [{ title: 'API', status: 'good' }] }, storePage), {
        kind: 'cards',
        title: null,
        cards: [{ title: 'API', text: null, status: 'good', wide: false }],
    });
    assert.throws(() => uiBlockFor('show_cards', { cards: [{ title: 'API', status: 'green' }] }, storePage), /good, warning, bad/);
});
