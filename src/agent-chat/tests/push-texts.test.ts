import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serverText } from '../server/utils/push-texts.ts';

const KEY = 'The answer could not be completed';

test('the sentence the chat writes itself comes from the language files', () => {
    assert.equal(serverText(KEY, 'de'), 'Die Antwort konnte nicht abgeschlossen werden');
    assert.equal(serverText(KEY, 'fr'), "La réponse n'a pas pu être terminée");
    assert.equal(serverText(KEY, 'nl'), 'Het antwoord kon niet worden voltooid');
    assert.equal(serverText(KEY, 'es'), 'No se pudo completar la respuesta');
    assert.equal(serverText(KEY, 'it'), 'Non è stato possibile completare la risposta');
});

test('English, an unknown language, no language and a text without translation give the English text', () => {
    assert.equal(serverText(KEY, 'en'), KEY);
    assert.equal(serverText(KEY, 'xx'), KEY);
    assert.equal(serverText(KEY, null), KEY);
    assert.equal(serverText('A text nobody translated', 'de'), 'A text nobody translated');
});
