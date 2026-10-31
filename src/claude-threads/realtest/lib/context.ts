/**
 * realtest — ScenarioContext: the transport-agnostic surface the scenarios use
 * to drive a conversation and read it back, plus where to find the artifacts
 * (sessions.json + working dir) for transcript correlation.
 *
 * Implemented over the isolated fake-Mattermost harness. (A real-Mattermost
 * implementation could be added the same way.)
 */
import type { ThreadPost } from './mm.js';
import type { BotHarness } from './bot-harness.js';
import type { FakeMattermost, FakePost } from './fake-mattermost.js';
import { sleep } from './mm.js';

export interface ScenarioBot {
  platformId: string;
  botName: string;
}

export interface ScenarioContext {
  bots: ScenarioBot[];
  workingDir: string;
  sessionsPath: string;
  channelId: string;
  /** Post as the human driver (optionally into a thread). */
  post(message: string, rootId?: string): Promise<ThreadPost>;
  getThread(rootId: string): Promise<ThreadPost[]>;
  /** Resolve once the thread has been quiet for `quietMs` (or `maxWaitMs`). */
  waitForQuiet(rootId: string, opts?: { quietMs?: number; maxWaitMs?: number; pollMs?: number }): Promise<ThreadPost[]>;
}

/** Build a ScenarioContext directly over a fake server + a human driver id. */
export function contextFromFake(
  fake: FakeMattermost,
  humanId: string,
  bots: ScenarioBot[],
  workingDir: string,
  sessionsPath: string,
): ScenarioContext {
  const toThreadPost = (p: FakePost): ThreadPost => ({
    id: p.id,
    createAt: p.create_at,
    userId: p.user_id,
    author: fake.userById(p.user_id)?.username ?? p.user_id,
    message: p.message,
    rootId: p.root_id || p.id,
  });

  return {
    bots,
    workingDir,
    sessionsPath,
    channelId: fake.channelId,
    async post(message, rootId) {
      return toThreadPost(fake.post(humanId, message, rootId));
    },
    async getThread(rootId) {
      return fake.thread(rootId).map(toThreadPost);
    },
    async waitForQuiet(rootId, opts = {}) {
      const quietMs = opts.quietMs ?? 8000;
      const maxWaitMs = opts.maxWaitMs ?? 180000;
      const pollMs = opts.pollMs ?? 1500;
      const start = Date.now();
      let lastCount = -1;
      let lastChange = Date.now();
      while (Date.now() - start < maxWaitMs) {
        const count = fake.thread(rootId).length;
        if (count !== lastCount) {
          lastCount = count;
          lastChange = Date.now();
        } else if (Date.now() - lastChange >= quietMs) {
          break;
        }
        await sleep(pollMs);
      }
      return fake.thread(rootId).map(toThreadPost);
    },
  };
}

/** Build a ScenarioContext backed by the isolated fake-Mattermost harness. */
export function contextFromHarness(h: BotHarness): ScenarioContext {
  return contextFromFake(
    h.fake,
    h.human.id,
    h.bots.map((b, i) => ({ platformId: i === 0 ? 'bot-a' : 'bot-b', botName: b.username })),
    h.workingDir,
    h.sessionsPath,
  );
}
