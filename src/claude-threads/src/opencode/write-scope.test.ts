import { describe, it, expect } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { evaluateWriteScope, extractAbsolutePaths, isInsideDir, ensurePermissionConfig } from './write-scope.js';

const SCOPE = ['/ai-agent-ux', '/tmp'];

describe('isInsideDir', () => {
  it('accepts the dir itself and children, rejects siblings and prefix-lookalikes', () => {
    expect(isInsideDir('/ai-agent-ux', '/ai-agent-ux')).toBe(true);
    expect(isInsideDir('/ai-agent-ux/mockups/x.html', '/ai-agent-ux')).toBe(true);
    expect(isInsideDir('/app/file.php', '/ai-agent-ux')).toBe(false);
    expect(isInsideDir('/ai-agent-ux-evil/x', '/ai-agent-ux')).toBe(false);
    expect(isInsideDir('/ai-agent-ux/../app/x', '/ai-agent-ux')).toBe(false); // resolved before compare
  });
});

describe('extractAbsolutePaths', () => {
  it('finds path tokens after delimiters but not URL slashes', () => {
    expect(extractAbsolutePaths('npx playwright screenshot http://localhost:8765/admin/orders /ai-agent-ux/shot.png'))
      .toEqual(['/ai-agent-ux/shot.png']);
    expect(extractAbsolutePaths('sed -i "s,a,b," /app/config.php')).toEqual(['/app/config.php']);
    expect(extractAbsolutePaths('ls -la')).toEqual([]);
  });
});

describe('evaluateWriteScope', () => {
  it('allows edits inside the scope (path in metadata)', () => {
    const p = { type: 'edit', title: 'Edit mockup.html', metadata: { filePath: '/ai-agent-ux/mockups/mockup.html' } };
    expect(evaluateWriteScope(p, SCOPE)).toBe('allow');
  });

  it('rejects edits outside the scope — the observed /app drift', () => {
    const p = { type: 'edit', title: 'Edit OrderView.vue', metadata: { filePath: '/app/resources/js/OrderView.vue' } };
    expect(evaluateWriteScope(p, SCOPE)).toBe('reject');
  });

  it('rejects a write request that names no recognizable path (fail closed)', () => {
    expect(evaluateWriteScope({ type: 'edit', title: 'Edit file', metadata: {} }, SCOPE)).toBe('reject');
  });

  it('rejects when ANY named path is outside the scope', () => {
    const p = { type: 'edit', title: 'copy', metadata: { from: '/ai-agent-ux/a', to: '/app/b' } };
    expect(evaluateWriteScope(p, SCOPE)).toBe('reject');
  });

  it('allows temp-dir writes (scratch space is in scope)', () => {
    const p = { type: 'write', title: 'Write', metadata: { filePath: '/tmp/scratch.png' } };
    expect(evaluateWriteScope(p, SCOPE)).toBe('allow');
  });

  it('bash: allows commands whose absolute paths stay in scope (URLs ignored)', () => {
    const p = {
      type: 'bash',
      title: 'npx playwright screenshot http://localhost:8765/admin/orders /ai-agent-ux/.playwright-mcp/shot.png',
      metadata: {},
    };
    expect(evaluateWriteScope(p, SCOPE)).toBe('allow');
  });

  it('bash: allows plain relative commands (cwd is the working dir)', () => {
    expect(evaluateWriteScope({ type: 'bash', title: 'npm run build', metadata: {} }, SCOPE)).toBe('allow');
  });

  it('bash: rejects commands referencing paths outside the scope', () => {
    const p = { type: 'bash', title: 'sed -i "s/a/b/" /app/routes/web.php', metadata: { command: 'sed -i "s/a/b/" /app/routes/web.php' } };
    expect(evaluateWriteScope(p, SCOPE)).toBe('reject');
  });

  it('bash: rejects `..` escapes out of the cwd', () => {
    expect(evaluateWriteScope({ type: 'bash', title: 'cd .. && rm -rf app', metadata: {} }, SCOPE)).toBe('reject');
    expect(evaluateWriteScope({ type: 'bash', title: 'cat ../../app/.env', metadata: {} }, SCOPE)).toBe('reject');
  });

  it('non-write types (webfetch etc.) are not gated', () => {
    expect(evaluateWriteScope({ type: 'webfetch', title: 'fetch https://example.com', metadata: {} }, SCOPE)).toBe('allow');
  });
});

describe('ensurePermissionConfig', () => {
  it('creates opencode.json with edit/bash = allow (unrestricted default)', () => {
    // Regression: without any config, a bot on opencode 1.18 couldn't write to
    // its own working dir. The default must pin edit/bash to "allow".
    const dir = mkdtempSync(join(tmpdir(), 'ws-'));

    expect(ensurePermissionConfig(dir, 'allow')).toBe('created');

    const config = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8'));
    expect(config.permission).toEqual({ edit: 'allow', bash: 'allow' });
  });

  it('creates opencode.json with edit/bash = ask (writeScope mode)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws-'));

    expect(ensurePermissionConfig(dir, 'ask')).toBe('created');

    const config = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8'));
    expect(config.permission).toEqual({ edit: 'ask', bash: 'ask' });
  });

  it('merges non-destructively: adds only missing keys, keeps everything else', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws-'));
    writeFileSync(join(dir, 'opencode.json'), JSON.stringify({ model: 'openrouter/x', permission: { edit: 'ask' } }));

    expect(ensurePermissionConfig(dir, 'allow')).toBe('updated');

    const config = JSON.parse(readFileSync(join(dir, 'opencode.json'), 'utf8'));
    expect(config.model).toBe('openrouter/x');       // untouched
    expect(config.permission.edit).toBe('ask');      // operator's explicit choice wins
    expect(config.permission.bash).toBe('allow');    // missing key added
  });

  it('is a no-op when both keys are already set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws-'));
    writeFileSync(join(dir, 'opencode.json'), JSON.stringify({ permission: { edit: 'ask', bash: 'deny' } }));

    expect(ensurePermissionConfig(dir, 'allow')).toBe('ok');
  });

  it('refuses to clobber an unparseable file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ws-'));
    writeFileSync(join(dir, 'opencode.json'), '{ not json');

    expect(ensurePermissionConfig(dir, 'allow')).toBe('failed');
    expect(readFileSync(join(dir, 'opencode.json'), 'utf8')).toBe('{ not json');
  });
});
