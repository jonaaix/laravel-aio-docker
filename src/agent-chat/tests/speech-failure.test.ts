import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serviceFailure } from '../server/utils/speech-failure.ts';

const answer = (status: number, body: string) => new Response(body, { status });

test('a refused key, an empty credit and other trouble are told apart', async () => {
    assert.equal((await serviceFailure(answer(401, 'unauthorized'))).reason, 'key');
    assert.equal((await serviceFailure(answer(400, '{"error":{"details":[{"reason":"API_KEY_INVALID"}]}}'))).reason, 'key');
    assert.equal((await serviceFailure(answer(402, '{"error":{"message":"Your prepayment credits are depleted."}}'))).reason, 'credit');
    assert.equal((await serviceFailure(answer(429, '{"error":{"code":"insufficient_quota"}}'))).reason, 'credit');
    assert.equal((await serviceFailure(answer(429, '{"error":"rate limited"}'))).reason, 'unavailable');
    assert.equal((await serviceFailure(answer(500, 'oops'))).reason, 'unavailable');
});
