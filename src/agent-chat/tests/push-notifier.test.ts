import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answerSnippet, buildPayload, createAnswerNotifier, recipientIds } from '../server/utils/push-notifier.ts';
import type { AnswerFinished, PushDelivery, StoredSubscription } from '../server/utils/push-notifier.ts';

const event: AnswerFinished = { conversationId: 'c1', conversationTitle: 'Plan the trip', participantIds: ['u1', 'u2'], mutedUserIds: [], agentName: 'Tarek', text: 'Done.', failed: false };

function subscription(endpoint: string, userId: string): StoredSubscription {
    return { endpoint, userId, p256dh: 'p', auth: 'a', language: null, vapidPublicKey: 'pk', vapidPrivateKey: 'sk', hubRef: 'h1' };
}

function fakeDelivery(stored: StoredSubscription[], overrides: Partial<PushDelivery> = {}) {
    const log = { sent: [] as { endpoint: string; userId: string; body: string }[], forgotten: [] as string[], errors: [] as unknown[], asked: [] as string[][] };
    const delivery: PushDelivery = {
        subscriptionsFor: (ids) => {
            log.asked.push(ids);
            return stored.filter(item => ids.includes(item.userId));
        },
        languageOf: () => null,
        translate: key => key,
        isAppVisible: () => false,
        send: async (item, payload) => {
            log.sent.push({ endpoint: item.endpoint, userId: payload.userId, body: payload.body });
            return 'sent';
        },
        forget: item => log.forgotten.push(item.endpoint),
        report: error => log.errors.push(error),
        ...overrides,
    };
    return { delivery, log };
}

test('the snippet drops markdown, code blocks and section bars and is cut with an ellipsis', () => {
    assert.equal(answerSnippet('**Done** with [the link](https://x.com) and `code`'), 'Done with the link and code');
    assert.equal(answerSnippet('Before\n```js\nconst a = 1;\n```\nAfter'), 'Before After');
    assert.equal(answerSnippet('╌╌╌╌╌\n🔑 TL;DR\n╌╌╌╌╌\nbody'), '🔑 TL;DR body');
    const cut = answerSnippet('word '.repeat(60));
    assert.ok(cut.length <= 140 && cut.endsWith('…'));
});

test('recipients are everyone who took part except those who muted the conversation', () => {
    assert.deepEqual(recipientIds(['u1', 'u2', 'u3'], []), ['u1', 'u2', 'u3']);
    assert.deepEqual(recipientIds(['u1', 'u2', 'u3'], ['u2']), ['u1', 'u3']);
    assert.deepEqual(recipientIds(['u1'], ['u1']), []);
    assert.deepEqual(recipientIds([], []), []);
});

test('the payload names the conversation, the agent and the person it is for', () => {
    assert.deepEqual(buildPayload(event, 'u2'), { title: 'Plan the trip', body: 'Tarek: Done.', conversationId: 'c1', userId: 'u2' });
});

test('a failed answer gets a plain sentence instead of text', () => {
    assert.equal(buildPayload({ ...event, failed: true, text: 'partial' }, 'u1').body, 'Tarek: The answer could not be completed');
});

test('a finished answer without plain text shows only the agent, never the failure sentence', () => {
    assert.equal(buildPayload({ ...event, text: '   ' }, 'u1').body, 'Tarek');
    assert.equal(buildPayload({ ...event, text: '```ts\nconst a = 1;\n```' }, 'u1').body, 'Tarek');
});

test('every device of the creator and of the last sender gets the notification', async () => {
    const { delivery, log } = fakeDelivery([subscription('e1', 'u1'), subscription('e2', 'u1'), subscription('e3', 'u2'), subscription('e4', 'u3')]);
    await createAnswerNotifier(delivery)(event);
    assert.deepEqual(log.sent.map(item => `${item.userId}:${item.endpoint}`).sort(), ['u1:e1', 'u1:e2', 'u2:e3']);
});

test('a device whose app is open on screen gets nothing, other devices still do', async () => {
    const { delivery, log } = fakeDelivery([subscription('phone', 'u1'), subscription('tablet', 'u1')], { isAppVisible: item => item.endpoint === 'phone' });
    await createAnswerNotifier(delivery)(event);
    assert.deepEqual(log.sent.map(item => item.endpoint), ['tablet']);
});

test('a subscription the push service no longer knows is forgotten', async () => {
    const { delivery, log } = fakeDelivery([subscription('old', 'u1'), subscription('new', 'u1')], { send: async item => (item.endpoint === 'old' ? 'gone' : 'sent') });
    await createAnswerNotifier(delivery)(event);
    assert.deepEqual(log.forgotten, ['old']);
});

test('one failing device does not stop the others and nothing is thrown', async () => {
    const { delivery, log } = fakeDelivery([subscription('bad', 'u1'), subscription('good', 'u1')], {
        send: async (item) => {
            if (item.endpoint === 'bad') {
                throw new Error('push service down');
            }
            return 'sent';
        },
    });
    await createAnswerNotifier(delivery)(event);
    assert.equal(log.errors.length, 1);
    assert.equal(log.forgotten.length, 0);
});

test('a broken store is reported instead of breaking the turn', async () => {
    const { delivery, log } = fakeDelivery([], { subscriptionsFor: () => { throw new Error('no such table: push_subscriptions'); } });
    await createAnswerNotifier(delivery)(event);
    assert.equal(log.errors.length, 1);
});

test('nobody is asked when the conversation has no person', async () => {
    const { delivery, log } = fakeDelivery([subscription('e1', 'u1')]);
    await createAnswerNotifier(delivery)({ ...event, participantIds: [] });
    assert.deepEqual(log.asked, [[]]);
    assert.equal(log.sent.length, 0);
});

test('the plain sentence of a failed answer is the one handed in, English by default', () => {
    const failed = { ...event, failed: true };
    assert.equal(buildPayload(failed, 'u1').body, 'Tarek: The answer could not be completed');
    assert.equal(buildPayload(failed, 'u1', 'Die Antwort konnte nicht abgeschlossen werden').body, 'Tarek: Die Antwort konnte nicht abgeschlossen werden');
});

test('every device gets the sentence in the language it was registered with or its person chose', async () => {
    const stored = [{ ...subscription('e1', 'u1'), language: 'it' }, { ...subscription('e2', 'u2'), language: 'fr' }, subscription('e3', 'u1')];
    const chosen: Record<string, string> = { u2: 'nl' };
    const { delivery, log } = fakeDelivery(stored, {
        languageOf: item => chosen[item.userId] ?? item.language,
        translate: (key, language) => (language ? `${key} [${language}]` : key),
    });
    await createAnswerNotifier(delivery)({ ...event, failed: true });
    assert.deepEqual(log.sent.map(item => `${item.endpoint}: ${item.body}`).sort(), [
        'e1: Tarek: The answer could not be completed [it]',
        'e2: Tarek: The answer could not be completed [nl]',
        'e3: Tarek: The answer could not be completed',
    ]);
});
