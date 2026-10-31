/**
 * Multi-channel connections.
 *
 * A connection's `channelId` may list several channels (comma/whitespace/
 * newline separated) so one connection can serve many channels without the
 * operator creating a separate connection each time.
 *
 * We keep the platform clients strictly single-channel (battle-tested: message
 * filtering, missed-message recovery, pinned context, MCP scoping and the
 * channel sticky all assume one channel). Instead we EXPAND a multi-channel
 * connection at registration time into one single-channel client per channel,
 * with a derived sub-id `"<baseId>#<channelId>"`.
 *
 * A single-channel connection expands to itself unchanged (`id` and
 * `channelId` byte-identical) — so existing configs behave exactly as before.
 */
import type { PlatformInstanceConfig } from './types.js';

/** Separator between a connection's base id and a channel in a derived sub-id. */
export const SUBPLATFORM_SEP = '#';

/** Parse a raw channelId field into a de-duplicated, ordered channel list. */
export function parseChannelIds(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    const c = part.trim();
    if (c && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

/**
 * Expand a connection into one single-channel platform config per channel.
 * Single-channel (or unset) → the original config, unchanged. Multi-channel →
 * N configs with sub-ids `"<baseId>#<channel>"` and a single `channelId` each.
 */
export function expandPlatformChannels(config: PlatformInstanceConfig): PlatformInstanceConfig[] {
  const channels = parseChannelIds((config as { channelId?: unknown }).channelId);
  if (channels.length <= 1) return [config];
  return channels.map(
    (channelId) =>
      ({
        ...config,
        id: `${config.id}${SUBPLATFORM_SEP}${channelId}`,
        channelId,
      }) as PlatformInstanceConfig,
  );
}

/**
 * True if `platformId` is a registered client belonging to the connection
 * `baseId` — either the base itself (single-channel) or one of its
 * `"<baseId>#<channel>"` sub-ids (multi-channel).
 */
export function belongsToConnection(platformId: string, baseId: string): boolean {
  return platformId === baseId || platformId.startsWith(`${baseId}${SUBPLATFORM_SEP}`);
}
