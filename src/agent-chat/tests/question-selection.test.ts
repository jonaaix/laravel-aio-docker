import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendableQuestions, withPick, withRecommendations } from '../app/utils/question-selection.ts';
import type { OfferedQuestion, QuestionSection } from '../app/utils/offered-questions.ts';

const option = (letter: string, recommended = false) => ({ letter, text: letter, recommended });
const question = (number: string, options: ReturnType<typeof option>[]): OfferedQuestion => ({ number, text: number, hint: '', options });
const section = (...questions: OfferedQuestion[]): QuestionSection => ({ title: 'Questions', intro: '', questions, outro: '' });

const first = section(question('1', [option('a', true), option('b')]), question('2', [option('a'), option('b', true)]));
const second = section(question('3', [option('a'), option('b')]), question('4', [option('a'), option('b')]));

test('picking adds, changes and removes only that question', () => {
    assert.deepEqual(withPick({}, first.questions[0]!, 'a'), { 1: 'a' });
    assert.deepEqual(withPick({ 1: 'a', 2: 'b' }, first.questions[0]!, 'b'), { 1: 'b', 2: 'b' });
    assert.deepEqual(withPick({ 1: 'a', 2: 'b' }, first.questions[0]!, 'a'), { 2: 'b' });
});

test('a choice in the second card keeps the choices of the first card', () => {
    const afterFirst = withPick({}, first.questions[0]!, 'a');
    assert.deepEqual(withPick(afterFirst, second.questions[0]!, 'a'), { 1: 'a', 3: 'a' });
});

test('accepting the recommendations of one card keeps the choices of another', () => {
    assert.deepEqual(withRecommendations({ 3: 'b' }, first), { 1: 'a', 2: 'b', 3: 'b' });
});

test('accepting replaces earlier choices for questions that have a recommendation', () => {
    assert.deepEqual(withRecommendations({ 1: 'b', 2: 'a' }, first), { 1: 'a', 2: 'b' });
    assert.deepEqual(withRecommendations({}, second), {});
});

test('a question without a recommendation keeps the choice already made', () => {
    const mixed = section(first.questions[0]!, question('9', [option('a'), option('b')]));
    assert.deepEqual(withRecommendations({ 1: 'b', 9: 'b' }, mixed), { 9: 'b', 1: 'a' });
    assert.deepEqual(withRecommendations({ 3: 'a' }, second), { 3: 'a' });
});

test('only questions with a recommended option count as recommendable', () => {
    assert.deepEqual(recommendableQuestions(first).map(item => item.number), ['1', '2']);
    assert.deepEqual(recommendableQuestions(second), []);
});
