/**
 * ConnectionForm — a single-screen, freely navigable connection editor.
 *
 * Replaces the old step-by-step wizard: every field is a row you can move
 * between (↑/↓), edit in place (Enter), with per-row validation shown inline.
 * A bad value never restarts the whole flow — you just fix that one row.
 *
 * Save assembles a {@link PlatformInstanceConfig} and hands it to `onSubmit`
 * (the console sends it as a `connection:save` command; the server hot-reloads
 * only that platform). The form does not touch config itself.
 */
import React from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { TextInput, PasswordInput, Select } from '@inkjs/ui';
import type {
  PlatformInstanceConfig,
  MattermostPlatformConfig,
  SlackPlatformConfig,
  PermissionMode,
  AgentBackendKind,
} from '../../config/index.js';

type FieldKind = 'text' | 'password' | 'select';

interface Field {
  key: string;
  label: string;
  section: string;
  kind: FieldKind;
  options?: { label: string; value: string }[];
  required?: boolean;
  /** Disallow editing (e.g. the id when editing an existing connection). */
  locked?: boolean;
}

const PERMISSION_OPTIONS = [
  { label: 'auto (recommended)', value: 'auto' },
  { label: 'default (strict)', value: 'default' },
  { label: 'bypass (trusted only)', value: 'bypass' },
];
const AGENT_OPTIONS = [
  { label: 'Claude Code', value: 'claude' },
  { label: 'opencode', value: 'opencode' },
];
const TYPE_OPTIONS = [
  { label: 'Mattermost', value: 'mattermost' },
  { label: 'Slack', value: 'slack' },
];
const VISIBILITY_OPTIONS = [
  { label: 'full', value: 'full' },
  { label: 'minimal', value: 'minimal' },
  { label: 'hidden', value: 'hidden' },
];
const WORKING_BLOCK_OPTIONS = [
  { label: 'expanded', value: 'expanded' },
  { label: 'hidden', value: 'hidden' },
];
const WRITE_SCOPE_OPTIONS = [
  { label: 'workingDir (own dir only)', value: 'workingDir' },
  { label: 'unrestricted (anywhere)', value: 'unrestricted' },
];

/** Field layout for the given platform type. */
function fieldsFor(type: string, editingExisting: boolean): Field[] {
  const connection: Field[] =
    type === 'slack'
      ? [
          { key: 'botName', label: 'Bot username', section: 'Connection', kind: 'text', required: true },
          { key: 'botToken', label: 'Bot token (xoxb-)', section: 'Connection', kind: 'password', required: true },
          { key: 'appToken', label: 'App token (xapp-)', section: 'Connection', kind: 'password', required: true },
          { key: 'channelId', label: 'Channel ID(s)', section: 'Connection', kind: 'text', required: true },
        ]
      : [
          { key: 'url', label: 'Server URL', section: 'Connection', kind: 'text', required: true },
          { key: 'botName', label: 'Bot username', section: 'Connection', kind: 'text', required: true },
          { key: 'token', label: 'Bot token', section: 'Connection', kind: 'password', required: true },
          { key: 'channelId', label: 'Channel ID(s)', section: 'Connection', kind: 'text', required: true },
        ];

  return [
    { key: 'id', label: 'ID', section: 'Identity', kind: 'text', required: true, locked: editingExisting },
    { key: 'type', label: 'Platform', section: 'Identity', kind: 'select', options: TYPE_OPTIONS, locked: editingExisting },
    { key: 'displayName', label: 'Display name', section: 'Identity', kind: 'text' },
    ...connection,
    { key: 'allowedUsers', label: 'Allowed users (comma-sep)', section: 'Access', kind: 'text' },
    { key: 'permissionMode', label: 'Permission mode', section: 'Access', kind: 'select', options: PERMISSION_OPTIONS },
    { key: 'agent', label: 'Agent backend', section: 'Behavior', kind: 'select', options: AGENT_OPTIONS },
    { key: 'model', label: 'Model (optional)', section: 'Behavior', kind: 'text' },
    { key: 'workingDir', label: 'Working dir (optional)', section: 'Behavior', kind: 'text' },
    { key: 'description', label: 'Specialization (optional)', section: 'Behavior', kind: 'text' },
    { key: 'sessionHeader', label: 'Session header', section: 'Behavior', kind: 'select', options: VISIBILITY_OPTIONS },
    { key: 'stickyMessage', label: 'Channel sticky', section: 'Behavior', kind: 'select', options: VISIBILITY_OPTIONS },
    { key: 'workingBlock', label: 'Working block', section: 'Behavior', kind: 'select', options: WORKING_BLOCK_OPTIONS },
    { key: 'writeScope', label: 'Write scope (opencode)', section: 'Behavior', kind: 'select', options: WRITE_SCOPE_OPTIONS },
  ];
}

/** Coerce a possibly-unset config value to a string, falling back to a default. */
function str(v: unknown, dflt: string): string {
  return typeof v === 'string' && v ? v : dflt;
}

/** Index at which to break the field list into two columns — the first section
 * boundary at or past the halfway point, so sections never straddle columns. */
function columnSplitIndex(fields: Field[]): number {
  const half = Math.ceil(fields.length / 2);
  for (let i = half; i < fields.length; i++) {
    if (fields[i].section !== fields[i - 1].section) return i;
  }
  return half;
}

function initialValues(initial?: PlatformInstanceConfig): Record<string, string> {
  const v: Record<string, string> = {
    id: initial?.id ?? '',
    type: initial?.type ?? 'mattermost',
    displayName: initial?.displayName ?? '',
    channelId: (initial as MattermostPlatformConfig | SlackPlatformConfig | undefined)?.channelId ?? '',
    botName: (initial as MattermostPlatformConfig | SlackPlatformConfig | undefined)?.botName ?? '',
    allowedUsers: (initial as MattermostPlatformConfig | SlackPlatformConfig | undefined)?.allowedUsers?.join(', ') ?? '',
    permissionMode: (initial as MattermostPlatformConfig | SlackPlatformConfig | undefined)?.permissionMode ?? 'auto',
    agent: (initial?.agent as string | undefined) ?? 'claude',
    model: typeof initial?.model === 'string' ? initial.model : '',
    workingDir: typeof initial?.workingDir === 'string' ? initial.workingDir : '',
    description: typeof initial?.description === 'string' ? initial.description : '',
    sessionHeader: str(initial?.sessionHeader, 'full'),
    stickyMessage: str(initial?.stickyMessage, 'full'),
    workingBlock: str(initial?.workingBlock, 'expanded'),
    writeScope: str(initial?.writeScope, 'workingDir'),
  };
  // PlatformInstanceConfig is the base interface (Mattermost/Slack extend it),
  // so `type` doesn't narrow — cast to read the type-specific fields.
  if (initial?.type === 'mattermost') {
    const mm = initial as MattermostPlatformConfig;
    v.url = mm.url ?? '';
    v.token = mm.token ?? '';
  } else if (initial?.type === 'slack') {
    const sl = initial as SlackPlatformConfig;
    v.botToken = sl.botToken ?? '';
    v.appToken = sl.appToken ?? '';
  }
  return v;
}

/** Validate one field's value; returns an error string or null. */
function validateField(field: Field, value: string, existingIds: string[], editingExisting: boolean): string | null {
  const v = value.trim();
  // When editing, an empty secret means "keep the existing one" (the console
  // never receives the real token), so don't treat it as a missing required.
  const requiredHere = field.required && !(editingExisting && field.kind === 'password');
  if (requiredHere && !v) return 'required';
  if (field.key === 'id') {
    if (!/^[a-z0-9-]+$/.test(v)) return 'lowercase letters, numbers, hyphens only';
    if (!editingExisting && existingIds.includes(v)) return 'id already in use';
  }
  if (field.key === 'url' && v && !/^https?:\/\//.test(v)) return 'must start with http:// or https://';
  return null;
}

export interface ConnectionFormProps {
  initial?: PlatformInstanceConfig;
  existingIds: string[];
  onSubmit: (config: PlatformInstanceConfig) => void;
  onCancel: () => void;
  /** Result/status line shown at the bottom (e.g. "Saving…" or an error). */
  status?: string;
}

export function ConnectionForm({ initial, existingIds, onSubmit, onCancel, status }: ConnectionFormProps) {
  const editingExisting = initial !== undefined;
  const [values, setValues] = React.useState<Record<string, string>>(() => initialValues(initial));
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [editing, setEditing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fields = fieldsFor(values.type, editingExisting);
  const active = fields[Math.min(activeIndex, fields.length - 1)];

  const commit = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setEditing(false);
  };

  const attemptSave = () => {
    for (const f of fields) {
      const err = validateField(f, values[f.key] ?? '', existingIds, editingExisting);
      if (err) {
        setActiveIndex(fields.indexOf(f));
        setError(`${f.label}: ${err}`);
        return;
      }
    }
    onSubmit(assembleConfig(values));
  };

  // Navigation keys are active only when NOT editing a field (the field's own
  // input captures keys while editing; Enter/selection commits and exits).
  useInput(
    (input, key) => {
      if (editing) return;
      if (key.escape) {
        onCancel();
        return;
      }
      if (key.upArrow) {
        setActiveIndex((i) => (i - 1 + fields.length) % fields.length);
        setError(null);
        return;
      }
      if (key.downArrow) {
        setActiveIndex((i) => (i + 1) % fields.length);
        setError(null);
        return;
      }
      if (key.return) {
        if (!active.locked) setEditing(true);
        return;
      }
      if (input === 's' || (key.ctrl && input === 's')) {
        attemptSave();
      }
    },
    { isActive: true },
  );

  const { stdout } = useStdout();
  const width = Math.min(Math.max(72, (stdout?.columns ?? 80) - 6), 110);

  // Two columns so a long form (many Behavior knobs) fits without scrolling.
  // Split on a section boundary near the middle so sections stay intact.
  const splitAt = columnSplitIndex(fields);
  const columns: Field[][] = [fields.slice(0, splitAt), fields.slice(splitAt)];
  const colWidth = Math.floor((width - 6) / 2);

  const renderRow = (f: Field, prevSection: string) => {
    const idx = fields.indexOf(f);
    const isActive = idx === activeIndex;
    const isEditingThis = isActive && editing;
    const val = values[f.key] ?? '';
    return (
      <Box key={f.key} flexDirection="column">
        {f.section !== prevSection && <Text dimColor bold>{f.section}</Text>}
        <Box>
          <Box width={2} flexShrink={0}><Text color="cyan">{isActive ? '❯' : ''}</Text></Box>
          <Box width={26} flexShrink={0}>
            <Text color={isActive ? 'cyan' : 'gray'} wrap="truncate">{f.label}</Text>
          </Box>
          <Box flexGrow={1}>
            {isEditingThis && f.kind === 'text' && (
              <TextInput defaultValue={val} onSubmit={(v) => commit(f.key, v)} />
            )}
            {isEditingThis && f.kind === 'password' && (
              <PasswordInput onSubmit={(v) => commit(f.key, v)} />
            )}
            {isEditingThis && f.kind === 'select' && (
              <Select options={f.options ?? []} defaultValue={val} onChange={(v) => commit(f.key, v)} />
            )}
            {!isEditingThis && (
              <Text dimColor={!val} wrap="truncate">
                {f.kind === 'password'
                  ? val
                    ? '••••••••'
                    : editingExisting
                      ? '(unchanged)'
                      : '(empty)'
                  : f.kind === 'select'
                    ? val
                    : val || '(empty)'}
              </Text>
            )}
          </Box>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} width={width}>
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">
          {editingExisting ? `Edit connection: ${values.id}` : 'Add connection'}
        </Text>
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
        {status && <Text color="yellow">{status}</Text>}
        <Text dimColor italic>
          ↑/↓ move · Enter edit · [s] save · [Esc] cancel
        </Text>
      </Box>
    </Box>
  );
}

/** Turn the flat form values into a typed PlatformInstanceConfig. */
function assembleConfig(v: Record<string, string>): PlatformInstanceConfig {
  const allowedUsers = (v.allowedUsers || '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  const base = {
    id: v.id.trim(),
    displayName: (v.displayName || v.id).trim(),
    channelId: v.channelId.trim(),
    botName: v.botName.trim(),
    allowedUsers,
    permissionMode: v.permissionMode as PermissionMode,
    ...(v.agent && v.agent !== 'claude' ? { agent: v.agent as AgentBackendKind } : {}),
    ...(v.model.trim() ? { model: v.model.trim() } : {}),
    ...(v.workingDir.trim() ? { workingDir: v.workingDir.trim() } : {}),
    ...(v.description.trim() ? { description: v.description.trim() } : {}),
    // Only persist non-default behavior knobs to keep the YAML minimal.
    ...(v.sessionHeader !== 'full' ? { sessionHeader: v.sessionHeader } : {}),
    ...(v.stickyMessage !== 'full' ? { stickyMessage: v.stickyMessage } : {}),
    ...(v.workingBlock !== 'expanded' ? { workingBlock: v.workingBlock } : {}),
    ...(v.writeScope !== 'workingDir' ? { writeScope: v.writeScope } : {}),
  };
  if (v.type === 'slack') {
    return {
      ...base,
      type: 'slack',
      botToken: v.botToken.trim(),
      appToken: v.appToken.trim(),
    } as SlackPlatformConfig;
  }
  return {
    ...base,
    type: 'mattermost',
    url: v.url.trim(),
    token: v.token.trim(),
  } as MattermostPlatformConfig;
}
