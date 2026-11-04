import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speakableText, speechChunks } from '../app/utils/speech-text.ts';
import { guessLanguage } from '../app/utils/speech-language.ts';

test('code blocks, markdown marks, bars and emoji are not read', () => {
    const text = speakableText('## ✅ Done\n\nRun `bun test` and see [the docs](https://x.y).\n\n```ts\nconst a = 1;\n```\n\n╌╌╌╌╌╌\n- **Bold** item');
    assert.equal(text, 'Done\nRun bun test and see the docs.\nBold item');
});

test('long text is cut into sentence-sized pieces', () => {
    const sentence = 'This sentence has a handful of words in it. ';
    const chunks = speechChunks(sentence.repeat(20).trim());
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every(chunk => chunk.length <= 200));
    assert.equal(chunks.join(' '), sentence.repeat(20).trim());
});

test('the language follows the text, short texts keep the chat language', () => {
    assert.equal(guessLanguage('Das ist nicht die Datei, die ich mit dir besprochen habe.', 'en'), 'de');
    assert.equal(guessLanguage('This is not the file that we talked about with the team.', 'de'), 'en');
    assert.equal(guessLanguage('Ce n’est pas le fichier que je cherche dans le dossier.', 'en'), 'fr');
    assert.equal(guessLanguage('Done.', 'de'), 'de');
});
