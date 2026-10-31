/**
 * Editable global settings — the bot-wide config the management console's
 * settings form exposes (the old wizard's "Global" + "Advanced" pages, plus a
 * few knobs that were previously YAML-only). A flat shape keeps the form
 * simple; {@link pickGlobalSettings} / {@link applyGlobalSettings} map to/from
 * the nested {@link Config}.
 *
 * Not everything applies live: `chrome` and `keepAlive` are hot; the rest are
 * persisted and take effect on the next restart (they're constructor-time
 * inputs to the SessionManager / AutoUpdateManager). The console flags which.
 *
 * Deliberately NOT exposed here (edit YAML directly): the Claude account pool
 * (`claudeAccounts`) and the auto-update schedule/timeouts — both niche and
 * awkward to render as a flat form.
 */
import type { Config, WorktreeMode } from './types.js';

export interface EditableGlobalSettings {
  // General
  workingDir: string;
  worktreeMode: WorktreeMode;
  respondOnlyWhenMentioned: boolean;
  chrome: boolean;
  keepAlive: boolean;
  maxBotHandoffs?: number;
  // Limits
  maxSessions?: number;
  sessionTimeoutMinutes?: number;
  sessionWarningMinutes?: number;
  permissionTimeoutSeconds?: number;
  flushDelayMs?: number;
  // Cleanup
  cleanupWorktrees: boolean;
  cleanupIntervalMinutes?: number;
  maxWorktreeAgeHours?: number;
  // Logs
  threadLogsEnabled: boolean;
  threadLogsRetentionDays?: number;
  // Updates
  autoUpdateEnabled: boolean;
  // Sticky message customization (global)
  stickyDescription: string;
  stickyFooter: string;
}

/** Which fields apply immediately vs. only after a restart. */
export const HOT_SETTINGS: ReadonlyArray<keyof EditableGlobalSettings> = ['chrome', 'keepAlive'];

export function pickGlobalSettings(config: Config): EditableGlobalSettings {
  return {
    workingDir: config.workingDir,
    worktreeMode: config.worktreeMode,
    respondOnlyWhenMentioned: !!config.respondOnlyWhenMentioned,
    chrome: !!config.chrome,
    keepAlive: config.keepAlive !== false,
    maxBotHandoffs: config.maxBotHandoffs,
    maxSessions: config.limits?.maxSessions,
    sessionTimeoutMinutes: config.limits?.sessionTimeoutMinutes,
    sessionWarningMinutes: config.limits?.sessionWarningMinutes,
    permissionTimeoutSeconds: config.limits?.permissionTimeoutSeconds,
    flushDelayMs: config.limits?.flushDelayMs,
    cleanupWorktrees: config.limits?.cleanupWorktrees !== false,
    cleanupIntervalMinutes: config.limits?.cleanupIntervalMinutes,
    maxWorktreeAgeHours: config.limits?.maxWorktreeAgeHours,
    threadLogsEnabled: config.threadLogs?.enabled !== false,
    threadLogsRetentionDays: config.threadLogs?.retentionDays,
    autoUpdateEnabled: config.autoUpdate?.enabled !== false,
    stickyDescription: config.stickyMessage?.description ?? '',
    stickyFooter: config.stickyMessage?.footer ?? '',
  };
}

/** Apply an edited settings object back onto a Config (mutates in place). */
export function applyGlobalSettings(config: Config, s: EditableGlobalSettings): void {
  config.workingDir = s.workingDir;
  config.worktreeMode = s.worktreeMode;
  config.chrome = s.chrome;

  // Persist only opt-ins that differ from the default, matching the config's
  // "keep it minimal" convention (mirrors the onboarding wizard).
  if (s.respondOnlyWhenMentioned) config.respondOnlyWhenMentioned = true;
  else delete config.respondOnlyWhenMentioned;
  if (!s.keepAlive) config.keepAlive = false;
  else delete config.keepAlive;
  if (s.maxBotHandoffs === undefined || Number.isNaN(s.maxBotHandoffs)) delete config.maxBotHandoffs;
  else config.maxBotHandoffs = s.maxBotHandoffs;

  const limits = { ...(config.limits ?? {}) };
  setOrDelete(limits, 'maxSessions', s.maxSessions);
  setOrDelete(limits, 'sessionTimeoutMinutes', s.sessionTimeoutMinutes);
  setOrDelete(limits, 'sessionWarningMinutes', s.sessionWarningMinutes);
  setOrDelete(limits, 'permissionTimeoutSeconds', s.permissionTimeoutSeconds);
  setOrDelete(limits, 'flushDelayMs', s.flushDelayMs);
  setOrDelete(limits, 'cleanupIntervalMinutes', s.cleanupIntervalMinutes);
  setOrDelete(limits, 'maxWorktreeAgeHours', s.maxWorktreeAgeHours);
  // cleanupWorktrees defaults to true → only persist the opt-out.
  if (!s.cleanupWorktrees) limits.cleanupWorktrees = false;
  else delete limits.cleanupWorktrees;
  config.limits = Object.keys(limits).length ? limits : undefined;

  const threadLogs = { ...(config.threadLogs ?? {}) };
  if (!s.threadLogsEnabled) threadLogs.enabled = false;
  else delete threadLogs.enabled;
  setOrDelete(threadLogs, 'retentionDays', s.threadLogsRetentionDays);
  config.threadLogs = Object.keys(threadLogs).length ? threadLogs : undefined;

  // autoUpdate defaults to enabled → only persist the opt-out (keeps other
  // autoUpdate fields the operator may have set in YAML untouched).
  const autoUpdate = { ...(config.autoUpdate ?? {}) };
  if (!s.autoUpdateEnabled) autoUpdate.enabled = false;
  else delete autoUpdate.enabled;
  config.autoUpdate = Object.keys(autoUpdate).length ? autoUpdate : undefined;

  const sticky: { description?: string; footer?: string } = {};
  if (s.stickyDescription.trim()) sticky.description = s.stickyDescription.trim();
  if (s.stickyFooter.trim()) sticky.footer = s.stickyFooter.trim();
  config.stickyMessage = Object.keys(sticky).length ? sticky : undefined;
}

function setOrDelete<T extends Record<string, unknown>, K extends keyof T>(obj: T, key: K, value: T[K] | undefined): void {
  if (value === undefined || value === null || (typeof value === 'number' && Number.isNaN(value))) delete obj[key];
  else obj[key] = value;
}
