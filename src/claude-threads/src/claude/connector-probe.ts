import { crossSpawn } from '../utils/spawn.js';
import { getClaudePath } from './version-check.js';
import { buildClaudeChildEnv, type ClaudeCliAccount } from './cli.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('connector-probe');

const CONNECTOR_PREFIX = 'claude.ai ';
const DEFAULT_CONNECTOR_PROBE_TIMEOUT_MS = 15_000;

export function parseConnectorNames(stdout: string): string[] | null {
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let event: { type?: string; subtype?: string; mcp_servers?: Array<{ name?: string }> };
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (event.type !== 'system' || event.subtype !== 'init') continue;
    return (event.mcp_servers ?? [])
      .map((s) => s.name ?? '')
      .filter((name) => name.startsWith(CONNECTOR_PREFIX))
      .map((name) => name.slice(CONNECTOR_PREFIX.length));
  }
  return null;
}

export async function probeClaudeAiConnectors(
  account?: ClaudeCliAccount,
  opts: { timeoutMs?: number } = {},
): Promise<string[] | null> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_CONNECTOR_PROBE_TIMEOUT_MS;
  const label = account?.id ?? 'default account';
  const env = buildClaudeChildEnv(process.env, account, { claudeAiConnectors: true });

  return new Promise<string[] | null>((resolve) => {
    let settled = false;
    let stdout = '';
    const finish = (value: string[] | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    let child: ReturnType<typeof crossSpawn>;
    try {
      // `/usage` costs no turn, and its system/init event lists the account's connectors.
      child = crossSpawn(getClaudePath(), ['-p', '/usage', '--output-format', 'stream-json', '--verbose'], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      log.warn(`Connector probe for ${label} failed to spawn: ${err}`);
      resolve(null);
      return;
    }

    const timer = setTimeout(() => {
      log.debug(`Connector probe for ${label} timed out after ${timeoutMs}ms`);
      child.kill('SIGKILL');
      finish(parseConnectorNames(stdout));
    }, timeoutMs);

    child.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      const names = parseConnectorNames(stdout);
      if (names === null) return;
      child.kill('SIGTERM');
      finish(names);
    });
    child.stderr?.on('data', () => {});
    child.on('error', (err: Error) => {
      log.warn(`Connector probe for ${label} errored: ${err}`);
      finish(null);
    });
    child.on('close', () => finish(parseConnectorNames(stdout)));
  });
}
