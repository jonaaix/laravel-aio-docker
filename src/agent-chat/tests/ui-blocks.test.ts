import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uiBlockFor } from '../server/utils/ui-blocks.ts';

const storePage = (path: string) => ({ url: `pages/${path}`, fileUrl: `files/${path}`, filename: path });
const twoOptions = [{ title: 'Compact list' }, { title: 'Cards', description: 'Roomier' }];

test('variants are lettered in order, each with its own page, and keep the recommendation', () => {
    const block = uiBlockFor('ask_visual_choice', { canvas: 'small', variants: [{ path: 'a.html', title: 'Cards' }, { path: 'b.html', title: 'Table', description: 'Dense' }], recommended: true }, storePage);
    assert.ok(block.kind === 'variants');
    assert.equal(block.columns, 2);
    assert.deepEqual(block.viewport, { height: 800 });
    assert.deepEqual(block.options.map(option => [option.letter, option.title, option.description, option.page.url]), [['a', 'Cards', null, 'pages/a.html'], ['b', 'Table', 'Dense', 'pages/b.html']]);
    assert.equal(block.recommended, 'a');
});

test('variants need a small or large canvas and a page each', () => {
    assert.throws(() => uiBlockFor('ask_visual_choice', { canvas: 'huge', variants: [{ path: 'a.html', title: 'A' }, { path: 'b.html', title: 'B' }] }, storePage), /canvas must be small or large/);
    assert.throws(() => uiBlockFor('ask_visual_choice', { canvas: 'constructor', variants: [{ path: 'a.html', title: 'A' }, { path: 'b.html', title: 'B' }] }, storePage), /canvas must be small or large/);
    assert.throws(() => uiBlockFor('ask_visual_choice', { canvas: 'large', variants: [{ path: 'a.html', title: 'A' }, { title: 'B' }] }, storePage), /variants\[1\]\.path is required/);
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

test('cards come in sections, each with its own status', () => {
    assert.deepEqual(uiBlockFor('show_cards', { sections: [{ heading: 'Done', status: 'good', cards: [{ title: 'API' }, { title: 'Docs', wide: true }] }] }, storePage), {
        kind: 'cards',
        sections: [{ heading: 'Done', status: 'good', cards: [{ title: 'API', text: null, wide: false }, { title: 'Docs', text: null, wide: true }] }],
    });
    assert.throws(() => uiBlockFor('show_cards', { sections: [{ heading: 'X', status: 'green', cards: [{ title: 'API' }] }] }, storePage), /good, warning, bad/);
    assert.throws(() => uiBlockFor('show_cards', { sections: [{ cards: [{ title: 'API' }] }] }, storePage), /sections\[0\]\.heading is required/);
});

test('a chart needs one number per label and one series for a pie', () => {
    const block = uiBlockFor('show_chart', { type: 'bar', labels: ['Mon', 'Tue'], series: [{ name: 'Orders', values: [3, 5] }], unit: '€' }, storePage);
    assert.deepEqual(block, { kind: 'chart', title: null, chartType: 'bar', labels: ['Mon', 'Tue'], series: [{ name: 'Orders', values: [3, 5] }], unit: '€' });
    assert.throws(() => uiBlockFor('show_chart', { type: 'line', labels: ['Mon', 'Tue'], series: [{ name: 'A', values: [1] }] }, storePage), /one number per label \(2\)/);
    assert.throws(() => uiBlockFor('show_chart', { type: 'pie', labels: ['A', 'B'], series: [{ name: 'X', values: [1, 2] }, { name: 'Y', values: [1, 2] }] }, storePage), /exactly one series/);
    assert.throws(() => uiBlockFor('show_chart', { type: 'radar', labels: ['A'], series: [{ name: 'X', values: [1] }] }, storePage), /type must be one of/);
});

test('a timeline keeps groups, markers and states', () => {
    assert.deepEqual(uiBlockFor('show_timeline', { groups: [{ heading: 'Today', items: [{ title: 'Deploy', marker: '09:30', state: 'done' }, { title: 'Review' }] }] }, storePage), {
        kind: 'timeline',
        groups: [{ heading: 'Today', dated: false, items: [{ title: 'Deploy', marker: '09:30', text: null, state: 'done', lane: null, start: null, end: null }, { title: 'Review', marker: null, text: null, state: null, lane: null, start: null, end: null }] }],
    });
    assert.throws(() => uiBlockFor('show_timeline', { groups: [{ items: [{ title: 'X', state: 'late' }] }] }, storePage), /done, active, open/);
});

test('a timeline reads lanes and spans, running past midnight', () => {
    const block = uiBlockFor('show_timeline', { groups: [{ items: [{ title: 'Tiramisu', lane: 'Dessert', start: '22:00', end: '08:00' }, { title: 'Roast', lane: 'Main', start: '17:30' }] }] }, storePage);
    assert.deepEqual(block.kind === 'timeline' && block.groups[0]!.items.map(item => [item.lane, item.start, item.end]), [['Dessert', 1320, 1920], ['Main', 1050, null]]);
    const dated = uiBlockFor('show_timeline', { groups: [{ items: [{ title: 'Trip', start: '2026-11-05 09:00', end: '2026-11-06 18:00' }] }] }, storePage);
    assert.equal(dated.kind === 'timeline' && dated.groups[0]!.dated, true);
    assert.throws(() => uiBlockFor('show_timeline', { groups: [{ items: [{ title: 'A', start: '09:00' }, { title: 'B' }] }] }, storePage), /every item a start/);
    assert.throws(() => uiBlockFor('show_timeline', { groups: [{ items: [{ title: 'A', start: '25:00' }] }] }, storePage), /HH:MM/);
    assert.throws(() => uiBlockFor('show_timeline', { groups: [{ items: [{ title: 'A', end: '09:00' }] }] }, storePage), /needs a start/);
});
