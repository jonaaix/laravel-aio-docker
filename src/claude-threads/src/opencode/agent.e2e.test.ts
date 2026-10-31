/**
 * opencode END-TO-END test — drives a REAL opencode server through the full
 * delivery pipeline (OpencodeAgent → per-session live SSE subscription →
 * OpencodeEventTranslator → emitted `'event'`), WITHOUT Mattermost. This is the
 * exact path that broke ("opencode answers on the server but never posts"), so
 * it catches those regressions without manual chat testing.
 *
 * Opt-in — it needs the real `opencode` binary on PATH and a provider/model with
 * working auth, and it spends a tiny real model call. Skipped unless enabled:
 *
 *   OPENCODE_E2E=1 bun test src/opencode/agent.e2e.test.ts
 *
 * Defaults to an opencode free-tier model, so no provider key is required.
 * Override for a specific provider/model you want to validate:
 *
 *   OPENCODE_E2E=1 OPENCODE_E2E_MODEL=openrouter/z-ai/glm-5.2 [OPENCODE_E2E_DIR=/app] \
 *     bun test src/opencode/agent.e2e.test.ts
 */

import { describe, it, expect, afterAll } from 'bun:test';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { OpencodeAgent, parseOpencodeModel } from './agent.js';
import { opencodeServer } from './server.js';
import type { AgentEvent } from '../agent/backend.js';

const ENABLED = process.env.OPENCODE_E2E === '1';
// Defaults to an opencode free-tier model so the test needs NO provider key —
// override for a specific provider/model (e.g. "openrouter/z-ai/glm-5.2").
const MODEL = process.env.OPENCODE_E2E_MODEL || 'opencode/deepseek-v4-flash-free';
// Deliberately NOT process.cwd(): opencode scopes its /event stream to a
// project (directory), and the server's own cwd is the fallback project. A
// session in a DIFFERENT directory is the case that broke in production
// (subscription looked live, but no session events ever arrived) — so the E2E
// default must exercise it. Override with OPENCODE_E2E_DIR to test a specific
// project directory.
const WORKDIR = process.env.OPENCODE_E2E_DIR || (ENABLED ? mkdtempSync(join(tmpdir(), 'opencode-e2e-')) : tmpdir());

// Pull the first non-empty assistant text out of the translated event stream.
function firstAssistantText(ev: AgentEvent): string | undefined {
  if (ev.type !== 'assistant') return undefined;
  const content = (ev as { message?: { content?: Array<{ type: string; text?: string }> } }).message?.content;
  const block = content?.find((b) => b.type === 'text' && b.text && b.text.trim());
  return block?.text?.trim();
}

(ENABLED ? describe : describe.skip)('opencode E2E (real server)', () => {
  afterAll(async () => {
    await opencodeServer.shutdown().catch(() => {});
  });

  it(
    'delivers a real assistant answer through the full pipeline',
    async () => {
      const agent = new OpencodeAgent({
        workingDir: WORKDIR,
        title: 'e2e',
        model: parseOpencodeModel(MODEL),
      });

      const answer = new Promise<string>((resolve, reject) => {
        agent.on('event', (ev: AgentEvent) => {
          const text = firstAssistantText(ev);
          if (text) resolve(text);
        });
        agent.on('exit', (code: number) => reject(new Error(`agent exited (code ${code}) before answering`)));
      });

      try {
        agent.start();
        agent.sendMessage('Reply with exactly the single word: pong');
        const text = await answer;

        // A real answer arrived through the whole chain — not an opencode error
        // surfaced as text ("⚠️ opencode could not …"), not empty.
        expect(text.length).toBeGreaterThan(0);
        expect(text.startsWith('⚠️')).toBe(false);
        // Instruction-following models say "pong"; assert loosely so a weak
        // model that adds fluff still passes as long as it answered.
        expect(text.toLowerCase()).toContain('pong');
      } finally {
        await agent.kill().catch(() => {});
      }
    },
    60_000,
  );
});
