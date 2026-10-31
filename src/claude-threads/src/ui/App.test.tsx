/**
 * Smoke/interaction tests for the management-hub TUI. Renders the real App with
 * ink-testing-library and drives it via keypresses, asserting the master/detail
 * layout, the connection form, and the help overlay actually appear.
 */
import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from './App.js';
import type { AppConfig } from './types.js';
import type { UISeedState } from './providers/types.js';

const config: AppConfig = {
  version: '9.9.9',
  workingDir: '/repo',
  claudeVersion: '2.1.0',
  claudeCompatible: true,
  permissionMode: 'auto',
  chromeEnabled: false,
  keepAliveEnabled: true,
};

const initialState: UISeedState = {
  ready: true,
  sessions: [
    { id: 'slack:t1', threadId: 't1', startedBy: 'alice', status: 'active', workingDir: '/repo', sessionNumber: 1, title: 'Fix auth bug', platformType: 'slack', platformDisplayName: 'Main Team' },
  ],
  platforms: [
    { id: 'slack', displayName: 'Main Team', botName: 'claude-code', url: 'slack.com', platformType: 'slack', connected: true, reconnecting: false, reconnectAttempts: 0, enabled: true },
  ],
  logs: [],
  update: undefined,
};

const getConnections = () => [
  { id: 'slack', type: 'slack', displayName: 'Main Team', botName: 'claude-code', channelId: 'C1', allowedUsers: ['alice'], permissionMode: 'auto', botToken: '', appToken: '' },
];

const settings = {
  workingDir: '/repo',
  worktreeMode: 'off',
  respondOnlyWhenMentioned: false,
  chrome: false,
  keepAlive: true,
  threadLogsEnabled: true,
};

function renderHub(opts?: { mode?: 'server' | 'console'; onLeave?: () => void; onStopServer?: () => void; onSettingsSave?: (s: unknown) => void }) {
  return render(
    React.createElement(App, {
      config,
      initialState,
      getConnections,
      getSettings: () => settings,
      onSettingsSave: opts?.onSettingsSave ?? (() => {}),
      mode: opts?.mode ?? 'server',
      onLeave: opts?.onLeave,
      onStopServer: opts?.onStopServer,
      onStateReady: () => {},
      actionCallbacks: {
        onConnectionSave: () => {},
        onConnectionRemove: () => {},
        onSessionCancel: () => {},
        onSessionInterrupt: () => {},
        onServerStop: () => {},
      },
      toggleCallbacks: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any),
  );
}

const tick = () => new Promise((r) => setTimeout(r, 50));

describe('management hub', () => {
  test('renders the master/detail layout with connections and sessions', async () => {
    const { lastFrame, unmount } = renderHub();
    await tick();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('management hub');
    expect(frame).toContain('Connections');
    expect(frame).toContain('Sessions');
    expect(frame).toContain('Main Team'); // connection row + detail
    expect(frame).toContain('Fix auth bug'); // session row
    expect(frame).toContain('tab'); // footer hint
    unmount();
  });

  test('pressing "a" opens the add-connection form', async () => {
    const { lastFrame, stdin, unmount } = renderHub();
    await tick();
    stdin.write('a');
    await tick();
    const frame = lastFrame() ?? '';
    // Form fields are visible (the centered title may clip on a short test tty).
    expect(frame).toContain('Server URL'); // a Mattermost connection field
    expect(frame).toContain('Permission mode');
    unmount();
  });

  test('pressing "?" opens the keyboard help overlay', async () => {
    const { lastFrame, stdin, unmount } = renderHub();
    await tick();
    stdin.write('?');
    await tick();
    // Assert a mid-list keybinding row (the centered title/hint can clip on a
    // short test tty; the middle rows stay visible).
    expect(lastFrame() ?? '').toContain('stop / interrupt session');
    unmount();
  });

  test('"g" opens the global settings form', async () => {
    const { lastFrame, stdin, unmount } = renderHub();
    await tick();
    stdin.write('g');
    await tick();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Worktree mode');
    expect(frame).toContain('Thread logs');
    unmount();
  });

  test('"q" opens the quit menu with both options', async () => {
    const { lastFrame, stdin, unmount } = renderHub();
    await tick();
    stdin.write('q');
    await tick();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Leave console');
    expect(frame).toContain('Quit server');
    unmount();
  });

  test('quit menu: selecting the first option calls onLeave (keep server running)', async () => {
    let left = false;
    let stopped = false;
    const { stdin, unmount } = renderHub({ onLeave: () => { left = true; }, onStopServer: () => { stopped = true; } });
    await tick();
    stdin.write('q');
    await tick();
    stdin.write('\r'); // Enter → first option "Leave console"
    await tick();
    expect(left).toBe(true);
    expect(stopped).toBe(false);
    unmount();
  });

  test('quit menu: selecting "Quit server" calls onStopServer', async () => {
    let left = false;
    let stopped = false;
    const { stdin, unmount } = renderHub({ onLeave: () => { left = true; }, onStopServer: () => { stopped = true; } });
    await tick();
    stdin.write('q');
    await tick();
    stdin.write('\x1B[B'); // arrow down → second option
    await tick();
    stdin.write('\r'); // Enter → "Quit server"
    await tick();
    expect(stopped).toBe(true);
    expect(left).toBe(false);
    unmount();
  });

  test('a multi-channel connection aggregates its channel clients into one row', async () => {
    const { lastFrame, unmount } = render(
      React.createElement(App, {
        config,
        mode: 'server',
        initialState: {
          ready: true,
          sessions: [],
          logs: [],
          platforms: [
            { id: 'mm#c1', displayName: 'Multi', botName: 'b', url: 'x', platformType: 'mattermost', connected: true, reconnecting: false, reconnectAttempts: 0, enabled: true },
            { id: 'mm#c2', displayName: 'Multi', botName: 'b', url: 'x', platformType: 'mattermost', connected: true, reconnecting: false, reconnectAttempts: 0, enabled: true },
          ],
        },
        getConnections: () => [
          { id: 'mm', type: 'mattermost', displayName: 'Multi', botName: 'b', channelId: 'c1, c2', allowedUsers: [], permissionMode: 'auto', url: 'x', token: '' },
        ],
        onStateReady: () => {},
        actionCallbacks: { onConnectionSave: () => {}, onConnectionRemove: () => {}, onSessionCancel: () => {}, onSessionInterrupt: () => {}, onServerStop: () => {} },
        toggleCallbacks: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any),
    );
    await tick();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Connections (1)'); // one row, not two
    expect(frame).toContain('2ch'); // channel count in the row meta
    expect(frame).toContain('connected'); // detail status = connected (both channels up)
    expect(frame).toContain('2/2 connected'); // Live count
    unmount();
  });

  test('Tab moves focus to the Sessions panel', async () => {
    const { lastFrame, stdin, unmount } = renderHub();
    await tick();
    stdin.write('\t');
    await tick();
    // The session detail (with the interrupt hint) shows once Sessions is focused.
    expect(lastFrame() ?? '').toContain('interrupt');
    unmount();
  });
});
