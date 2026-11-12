/**
 * SettingsForm — edit the bot-wide global settings from the console (the old
 * wizard's "Global" + "Advanced" pages). Same navigable in-place-edit UX as the
 * ConnectionForm. Save hands an EditableGlobalSettings to `onSubmit`; the
 * console sends it as a `settings:save` command and the server persists it.
 *
 * `chrome` and `keep-alive` apply live; the rest take effect on next restart —
 * flagged in the field labels + the footer hint.
 */
import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { TextInput, Select } from '@inkjs/ui';
import { LIMITS_DEFAULTS } from '../../config/index.js';
import type { EditableGlobalSettings } from '../../config/index.js';
import type { WorktreeMode } from '../../config/index.js';

type Kind = 'text' | 'select';
interface SField {
  key: keyof Vals;
  label: string;
  section: string;
  kind: Kind;
  options?: { label: string; value: string }[];
  numeric?: boolean;
  /** Shown as "(default: …)" when the field is left empty. */
  def?: string;
}
type Vals = Record<string, string>;

const YES_NO = [
  { label: 'no', value: 'no' },
  { label: 'yes', value: 'yes' },
];
const WORKTREE = [
  { label: 'prompt', value: 'prompt' },
  { label: 'off', value: 'off' },
  { label: 'require', value: 'require' },
];

const FIELDS: SField[] = [
  { key: 'workingDir', label: 'Working dir', section: 'General', kind: 'text' },
  { key: 'worktreeMode', label: 'Worktree mode', section: 'General', kind: 'select', options: WORKTREE },
  { key: 'respondOnlyWhenMentioned', label: 'Only when @mentioned', section: 'General', kind: 'select', options: YES_NO },
  { key: 'chrome', label: 'Chrome (live)', section: 'General', kind: 'select', options: YES_NO },
  { key: 'keepAlive', label: 'Keep-alive (live)', section: 'General', kind: 'select', options: YES_NO },
  { key: 'maxBotHandoffs', label: 'Max bot handoffs', section: 'General', kind: 'text', numeric: true, def: '25' },
  { key: 'maxSessions', label: 'Max sessions', section: 'Limits', kind: 'text', numeric: true, def: String(LIMITS_DEFAULTS.maxSessions) },
  { key: 'sessionTimeoutMinutes', label: 'Idle timeout (min)', section: 'Limits', kind: 'text', numeric: true, def: String(LIMITS_DEFAULTS.sessionTimeoutMinutes) },
  { key: 'sessionWarningMinutes', label: 'Warn before (min)', section: 'Limits', kind: 'text', numeric: true, def: String(LIMITS_DEFAULTS.sessionWarningMinutes) },
  { key: 'permissionTimeoutSeconds', label: 'Perm timeout (sec)', section: 'Limits', kind: 'text', numeric: true, def: String(LIMITS_DEFAULTS.permissionTimeoutSeconds) },
  { key: 'flushDelayMs', label: 'Flush delay (ms)', section: 'Limits', kind: 'text', numeric: true, def: String(LIMITS_DEFAULTS.flushDelayMs) },
  { key: 'cleanupWorktrees', label: 'Cleanup worktrees', section: 'Cleanup', kind: 'select', options: YES_NO },
  { key: 'cleanupIntervalMinutes', label: 'Cleanup interval (min)', section: 'Cleanup', kind: 'text', numeric: true, def: String(LIMITS_DEFAULTS.cleanupIntervalMinutes) },
  { key: 'maxWorktreeAgeHours', label: 'Max worktree age (h)', section: 'Cleanup', kind: 'text', numeric: true, def: String(LIMITS_DEFAULTS.maxWorktreeAgeHours) },
  { key: 'threadLogsEnabled', label: 'Thread logs', section: 'Logs', kind: 'select', options: YES_NO },
  { key: 'threadLogsRetentionDays', label: 'Log retention (days)', section: 'Logs', kind: 'text', numeric: true, def: '30' },
  { key: 'autoUpdateEnabled', label: 'Auto-update', section: 'Updates', kind: 'select', options: YES_NO },
  { key: 'stickyDescription', label: 'Sticky description', section: 'Sticky', kind: 'text' },
  { key: 'stickyFooter', label: 'Sticky footer', section: 'Sticky', kind: 'text' },
];

function toVals(s: EditableGlobalSettings): Vals {
  const num = (n?: number) => (n === undefined ? '' : String(n));
  return {
    workingDir: s.workingDir,
    worktreeMode: s.worktreeMode,
    respondOnlyWhenMentioned: s.respondOnlyWhenMentioned ? 'yes' : 'no',
    chrome: s.chrome ? 'yes' : 'no',
    keepAlive: s.keepAlive ? 'yes' : 'no',
    maxBotHandoffs: num(s.maxBotHandoffs),
    maxSessions: num(s.maxSessions),
    sessionTimeoutMinutes: num(s.sessionTimeoutMinutes),
    sessionWarningMinutes: num(s.sessionWarningMinutes),
    permissionTimeoutSeconds: num(s.permissionTimeoutSeconds),
    flushDelayMs: num(s.flushDelayMs),
    cleanupWorktrees: s.cleanupWorktrees ? 'yes' : 'no',
    cleanupIntervalMinutes: num(s.cleanupIntervalMinutes),
    maxWorktreeAgeHours: num(s.maxWorktreeAgeHours),
    threadLogsEnabled: s.threadLogsEnabled ? 'yes' : 'no',
    threadLogsRetentionDays: num(s.threadLogsRetentionDays),
    autoUpdateEnabled: s.autoUpdateEnabled ? 'yes' : 'no',
    stickyDescription: s.stickyDescription,
    stickyFooter: s.stickyFooter,
  };
}

function parseNum(v: string): number | undefined {
  const t = v.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function toSettings(v: Vals): EditableGlobalSettings {
  return {
    workingDir: v.workingDir.trim(),
    worktreeMode: v.worktreeMode as WorktreeMode,
    respondOnlyWhenMentioned: v.respondOnlyWhenMentioned === 'yes',
    chrome: v.chrome === 'yes',
    keepAlive: v.keepAlive === 'yes',
    maxBotHandoffs: parseNum(v.maxBotHandoffs),
    maxSessions: parseNum(v.maxSessions),
    sessionTimeoutMinutes: parseNum(v.sessionTimeoutMinutes),
    sessionWarningMinutes: parseNum(v.sessionWarningMinutes),
    permissionTimeoutSeconds: parseNum(v.permissionTimeoutSeconds),
    flushDelayMs: parseNum(v.flushDelayMs),
    cleanupWorktrees: v.cleanupWorktrees === 'yes',
    cleanupIntervalMinutes: parseNum(v.cleanupIntervalMinutes),
    maxWorktreeAgeHours: parseNum(v.maxWorktreeAgeHours),
    threadLogsEnabled: v.threadLogsEnabled === 'yes',
    threadLogsRetentionDays: parseNum(v.threadLogsRetentionDays),
    autoUpdateEnabled: v.autoUpdateEnabled === 'yes',
    stickyDescription: v.stickyDescription ?? '',
    stickyFooter: v.stickyFooter ?? '',
  };
}

function validate(field: SField, value: string): string | null {
  const v = value.trim();
  if (field.key === 'workingDir' && !v) return 'required';
  if (field.numeric && v && !Number.isFinite(Number(v))) return 'must be a number';
  return null;
}

export interface SettingsFormProps {
  initial: EditableGlobalSettings;
  onSubmit: (settings: EditableGlobalSettings) => void;
  onCancel: () => void;
}

export function SettingsForm({ initial, onSubmit, onCancel }: SettingsFormProps) {
  const [values, setValues] = React.useState<Vals>(() => toVals(initial));
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const commit = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setEditing(false);
  };
  const attemptSave = () => {
    for (const f of FIELDS) {
      const err = validate(f, values[f.key] ?? '');
      if (err) {
        setActiveIndex(FIELDS.indexOf(f));
        setError(`${f.label}: ${err}`);
        return;
      }
    }
    onSubmit(toSettings(values));
  };

  useInput((input, key) => {
    if (editing) return;
    if (key.escape) return onCancel();
    if (key.upArrow) {
      setActiveIndex((i) => (i - 1 + FIELDS.length) % FIELDS.length);
      setError(null);
      return;
    }
    if (key.downArrow) {
      setActiveIndex((i) => (i + 1) % FIELDS.length);
      setError(null);
      return;
    }
    if (key.return) {
      setEditing(true);
      return;
    }
    if (input === 's') attemptSave();
  });

  const { stdout } = useStdout();
  const width = Math.min(Math.max(72, (stdout?.columns ?? 80) - 6), 110);

  // Two columns so the whole form fits on one screen without scrolling. Split
  // on a section boundary near the halfway mark (sections stay intact).
  const splitAt = columnSplitIndex(FIELDS);
  const columns: SField[][] = [FIELDS.slice(0, splitAt), FIELDS.slice(splitAt)];
  const colWidth = Math.floor((width - 6) / 2);

  const renderRow = (f: SField, prevSection: string) => {
    const idx = FIELDS.indexOf(f);
    const isActive = idx === activeIndex;
    const isEditingThis = isActive && editing;
    const val = values[f.key] ?? '';
    return (
      <Box key={f.key} flexDirection="column">
        {f.section !== prevSection && <Text dimColor bold>{f.section}</Text>}
        <Box>
          <Box width={2} flexShrink={0}><Text color="cyan">{isActive ? '❯' : ''}</Text></Box>
          <Box width={24} flexShrink={0}><Text color={isActive ? 'cyan' : 'gray'} wrap="truncate">{f.label}</Text></Box>
          <Box flexGrow={1}>
            {isEditingThis && f.kind === 'text' && <TextInput defaultValue={val} onSubmit={(v) => commit(f.key, v)} />}
            {isEditingThis && f.kind === 'select' && (
              <Select options={f.options ?? []} defaultValue={val} onChange={(v) => commit(f.key, v)} />
            )}
            {!isEditingThis && <Text dimColor={!val} wrap="truncate">{val || (f.def ? `(default: ${f.def})` : '(default)')}</Text>}
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} width={width}>
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">Global settings</Text>
      </Box>
      <Box flexDirection="row" gap={2}>
        {columns.map((col, ci) => {
          let prevSection = '';
          return (
            <Box key={ci} flexDirection="column" width={colWidth}>
              {col.map((f) => {
                const row = renderRow(f, prevSection);
                prevSection = f.section;
                return row;
              })}
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1} flexDirection="column">
        {error && <Text color="red">⚠ {error}</Text>}
        <Text dimColor italic>↑/↓ move · Enter edit · [s] save · [Esc] cancel · (live) = applies now, rest on restart</Text>
      </Box>
    </Box>
  );
}

/** Index at which to break FIELDS into two columns — the first section boundary
 * at or past the halfway point, so sections never straddle columns. */
function columnSplitIndex(fields: SField[]): number {
  const half = Math.ceil(fields.length / 2);
  for (let i = half; i < fields.length; i++) {
    if (fields[i].section !== fields[i - 1].section) return i;
  }
  return half;
}
