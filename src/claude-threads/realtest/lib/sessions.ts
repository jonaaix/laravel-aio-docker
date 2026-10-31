/**
 * realtest — read the bot's persisted session index to correlate a chat thread
 * with the underlying Claude session id (→ its transcript on disk).
 *
 * `~/.config/claude-threads/sessions.json` maps `"<platformId>:<threadId>"` to a
 * PersistedSession that carries the `claudeSessionId`. We use it to find, for a
 * given bot + thread, exactly which transcript to analyze.
 */
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface PersistedRef {
  sessionId: string;
  platformId: string;
  threadId: string;
  claudeSessionId?: string;
  softDeleted: boolean;
}

const SESSIONS_PATH = join(homedir(), '.config', 'claude-threads', 'sessions.json');

interface RawSession {
  platformId?: string;
  threadId?: string;
  claudeSessionId?: string;
  softDeletedAt?: unknown;
}

export function readPersistedSessions(path = SESSIONS_PATH): PersistedRef[] {
  if (!existsSync(path)) return [];
  let data: { sessions?: Record<string, RawSession> };
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return [];
  }
  const out: PersistedRef[] = [];
  for (const [sessionId, s] of Object.entries(data.sessions || {})) {
    out.push({
      sessionId,
      platformId: s.platformId ?? sessionId.split(':')[0],
      threadId: s.threadId ?? sessionId.split(':').slice(1).join(':'),
      claudeSessionId: s.claudeSessionId,
      softDeleted: !!s.softDeletedAt,
    });
  }
  return out;
}

/** Find the Claude session id for a bot (platformId) in a given thread. */
export function findClaudeSession(platformId: string, threadId: string, path = SESSIONS_PATH): string | undefined {
  return readPersistedSessions(path).find((r) => r.platformId === platformId && r.threadId === threadId)
    ?.claudeSessionId;
}
