import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { HEARTBEAT_MS, startHeartbeat } from '../server/utils/event-heartbeat.ts';

function fakeStream() {
    const pushed: Array<{ event: string; data: string }> = [];
    return { pushed, push: (message: { event: string; data: string }) => pushed.push(message) };
}

test('a ping is sent at every interval as a named event with data, so a browser can see it', () => {
    mock.timers.enable({ apis: ['setInterval'] });
    const stream = fakeStream();
    const stop = startHeartbeat(stream);
    mock.timers.tick(HEARTBEAT_MS - 1);
    assert.equal(stream.pushed.length, 0);
    mock.timers.tick(1);
    assert.deepEqual(stream.pushed, [{ event: 'ping', data: '1' }]);
    mock.timers.tick(HEARTBEAT_MS);
    assert.equal(stream.pushed.length, 2);
    stop();
    mock.timers.reset();
});

test('after stopping no more pings are sent', () => {
    mock.timers.enable({ apis: ['setInterval'] });
    const stream = fakeStream();
    const stop = startHeartbeat(stream, 1000);
    stop();
    mock.timers.tick(10_000);
    assert.equal(stream.pushed.length, 0);
    mock.timers.reset();
});

test('a ping that cannot be written is dropped without an unhandled rejection', async () => {
    mock.timers.enable({ apis: ['setInterval'] });
    const unhandled: unknown[] = [];
    const listener = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', listener);
    const stop = startHeartbeat({ push: () => Promise.reject(new Error('socket closed')) }, 1000);
    mock.timers.tick(3000);
    await new Promise(resolve => setImmediate(resolve));
    stop();
    process.off('unhandledRejection', listener);
    mock.timers.reset();
    assert.deepEqual(unhandled, []);
});
