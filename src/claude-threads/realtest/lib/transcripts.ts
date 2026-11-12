/**
 * realtest — Claude Code transcript reader.
 *
 * The bot spawns a `claude` session per thread; that session writes a full
 * JSONL transcript to `~/.claude/projects/<encoded-cwd>/<claudeSessionId>.jsonl`.
 * We read those transcripts to check, for real, what each bot actually sent to
 * the model: the conversation turns it saw and the exact token usage per turn.
 *
 * This file is intentionally pure + dependency-light so it can be unit-tested
 * against fixtures without touching disk or the network. `parseTranscript`
 * takes the raw JSONL text; the disk helpers are thin wrappers around it.
 */
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

/** Normalized token usage for one assistant turn. */
export interface TokenUsage {
  /** Fresh, uncached input tokens (billed at 1×). */
  input: number;
  /** Tokens written into the prompt cache this turn (billed ~1.25×). */
  cacheCreate: number;
  /** Tokens read from the prompt cache (billed ~0.1×). */
  cacheRead: number;
  /** Generated output tokens. */
  output: number;
}

export interface Turn {
  role: 'user' | 'assistant';
  /** Concatenated text content (tool_use / tool_result blocks are summarized). */
  text: string;
  model?: string;
  usage?: TokenUsage;
}

/** Total input the model actually processed this turn (fresh + both cache legs). */
export function totalInput(u: TokenUsage): number {
  return u.input + u.cacheCreate + u.cacheRead;
}

interface RawUsage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
}

function normalizeUsage(u: RawUsage | undefined): TokenUsage | undefined {
  if (!u) return undefined;
  return {
    input: u.input_tokens ?? 0,
    cacheCreate: u.cache_creation_input_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
    output: u.output_tokens ?? 0,
  };
}

/** Extract plain text from a Claude message `content` (string or block array). */
export function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content as Array<Record<string, unknown>>) {
    if (block?.type === 'text' && typeof block.text === 'string') parts.push(block.text);
    else if (block?.type === 'tool_use') parts.push(`«tool_use:${String(block.name ?? '')}»`);
    else if (block?.type === 'tool_result') parts.push('«tool_result»');
  }
  return parts.join('');
}

/**
 * Parse a transcript's raw JSONL into ordered conversation turns. Only
 * user/assistant message lines are kept; queue-operation / attachment /
 * result / last-prompt bookkeeping lines are ignored. Malformed lines skipped.
 */
export function parseTranscript(jsonl: string): Turn[] {
  const turns: Turn[] = [];
  for (const line of jsonl.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(t);
    } catch {
      continue;
    }
    if (obj.type !== 'user' && obj.type !== 'assistant') continue;
    const msg = obj.message as Record<string, unknown> | undefined;
    if (!msg) continue;
    const role = (msg.role as 'user' | 'assistant') ?? (obj.type as 'user' | 'assistant');
    turns.push({
      role,
      text: extractText(msg.content),
      model: typeof msg.model === 'string' ? msg.model : undefined,
      usage: normalizeUsage(msg.usage as RawUsage | undefined),
    });
  }
  return turns;
}

/** Path to the Claude projects dir for a given working directory. */
export function transcriptDir(workingDir: string): string {
  // Claude encodes the cwd by replacing path separators (and other non
  // [A-Za-z0-9] chars) with '-'.
  const encoded = workingDir.replace(/[^A-Za-z0-9]/g, '-');
  return join(homedir(), '.claude', 'projects', encoded);
}

/** Read + parse a transcript by claude session id. Returns [] if missing. */
export function readTranscript(workingDir: string, claudeSessionId: string): Turn[] {
  const file = join(transcriptDir(workingDir), `${claudeSessionId}.jsonl`);
  if (!existsSync(file)) return [];
  return parseTranscript(readFileSync(file, 'utf8'));
}
