#!/usr/bin/env node

import { program } from 'commander';
import {
  loadConfigWithMigration,
  configExists as checkConfigExists,
  saveConfig,
  resolvePermissionMode,
  resolveOverheadVisibility,
  isOverheadVisibility,
  OVERHEAD_VISIBILITY_VALUES,
  resolveAgentBackend,
  isWorkingBlockMode,
  isWriteScopeMode,
  expandPlatformChannels,
  belongsToConnection,
  pickGlobalSettings,
  applyGlobalSettings,
  type EditableGlobalSettings,
  type MattermostPlatformConfig,
  type SlackPlatformConfig,
  type PlatformInstanceConfig,
  type PermissionMode,
  type OverheadVisibility,
} from './config/index.js';
import type { CliArgs } from './config/index.js';
import { runOnboarding } from './onboarding.js';
import { MattermostClient, SlackClient, type PlatformClient, type PlatformPost, type PlatformUser } from './platform/index.js';
import { SessionManager } from './session/index.js';
import { opencodeServer } from './opencode/server.js';
import { opencodeMcpHost } from './mcp/opencode-mcp-host.js';
import { SessionStore } from './persistence/session-store.js';
import { checkForUpdates } from './update-notifier.js';
import { VERSION } from './version.js';
import { keepAlive } from './utils/keep-alive.js';
import { startReactMeasureCleanup } from './utils/perf-cleanup.js';
import { dim, red } from './utils/colors.js';
import { validateClaudeCli } from './claude/version-check.js';
import { validateOpencode } from './opencode/version-check.js';
import { startUI, type UIProvider, type AppConfig } from './ui/index.js';
import type { ToggleCallbacks } from './ui/types.js';
import { ControlClient, ServerBridge, runConsoleClient } from './ipc/index.js';
import { spawn } from 'child_process';
import { setLogHandler } from './utils/logger.js';
import { handleMessage } from './message-handler.js';
import { AutoUpdateManager } from './auto-update/index.js';
import {
  loadUpdateState,
  saveRuntimeSettings,
  getRuntimeSettings,
  clearRuntimeSettings,
} from './auto-update/installer.js';

// =============================================================================
// Platform Factory and Event Wiring
// =============================================================================

/**
 * Create a platform client based on the config type.
 */
function createPlatformClient(config: PlatformInstanceConfig): PlatformClient {
  switch (config.type) {
    case 'mattermost':
      return new MattermostClient(config as MattermostPlatformConfig);
    case 'slack':
      return new SlackClient(config as SlackPlatformConfig);
    default:
      throw new Error(`Unsupported platform type: ${(config as PlatformInstanceConfig).type}`);
  }
}

/**
 * Wire up platform events to session manager and UI.
 */
function wirePlatformEvents(
  platformId: string,
  client: PlatformClient,
  session: SessionManager,
  ui: UIProvider
): void {
  // Handle incoming messages
  client.on('message', async (post: PlatformPost, user: PlatformUser | null) => {
    await handleMessage(client, session, post, user, {
      platformId,
      logger: {
        error: (msg) => ui.addLog({ level: 'error', component: '❌', message: msg }),
      },
      onKill: (username) => {
        ui.addLog({ level: 'error', component: '🔴', message: `EMERGENCY SHUTDOWN initiated by @${username}` });
        // Exit with code 0 so daemon doesn't restart us
        process.exit(0);
      },
    });
  });

  // Wire up connection status events to UI
  client.on('connected', () => {
    ui.setPlatformStatus(platformId, { connected: true, reconnecting: false, reconnectAttempts: 0 });
  });
  client.on('disconnected', () => {
    ui.setPlatformStatus(platformId, { connected: false, reconnecting: true });
  });
  client.on('reconnecting', (attempt: number) => {
    ui.setPlatformStatus(platformId, { reconnecting: true, reconnectAttempts: attempt });
  });
  client.on('error', (e) => {
    const message = e instanceof Error ? e.message : String(e);
    ui.addLog({ level: 'error', component: platformId, message });
  });
}

// =============================================================================
// CLI Options
// =============================================================================

// Define CLI options
program
  .name('claude-threads')
  .version(VERSION)
  .description('Share Claude Code sessions in Mattermost')
  .option('--url <url>', 'Mattermost server URL')
  .option('--token <token>', 'Mattermost bot token')
  .option('--channel <id>', 'Mattermost channel ID')
  .option('--bot-name <name>', 'Bot mention name (default: claude-code)')
  .option('--allowed-users <users>', 'Comma-separated allowed usernames')
  .option('--permission-mode <mode>', 'Permission mode: default | auto | bypass (default: from config)')
  .option('--skip-permissions', '[deprecated] Alias for --permission-mode bypass')
  .option('--no-skip-permissions', '[deprecated] Alias for --permission-mode default')
  .option('--chrome', 'Enable Claude in Chrome integration')
  .option('--no-chrome', 'Disable Claude in Chrome integration')
  .option('--worktree-mode <mode>', 'Git worktree mode: off, prompt, require (default: prompt)')
  .option('--session-header <mode>', 'Per-thread session header: full | minimal | hidden. Overrides per-platform config.')
  .option('--sticky-message <mode>', 'Channel sticky message: full | minimal | hidden. Overrides per-platform config.')
  .option('--keep-alive', 'Enable system sleep prevention (default: enabled)')
  .option('--no-keep-alive', 'Disable system sleep prevention')
  .option('--setup', 'Open the management console (add/edit connections interactively)')
  .option('--wizard', 'Run the legacy step-by-step setup wizard (fallback)')
  .option('--debug', 'Enable debug logging')
  .option('--skip-version-check', 'Skip Claude CLI version compatibility check')
  .option('--auto-restart', 'Enable auto-restart on updates (default when autoUpdate enabled)')
  .option('--no-auto-restart', 'Disable auto-restart on updates')
  .option('--headless', 'Run without interactive UI (logs to stdout)')
  .parse();

const opts = program.opts();

// Determine headless mode: explicit flag or auto-detect when no TTY.
// CLAUDE_THREADS_INTERACTIVE is set by the daemon wrapper to override TTY detection,
// since background jobs (&) lose TTY assignment even when the parent terminal is interactive.
const forcedInteractive = !!process.env.CLAUDE_THREADS_INTERACTIVE;
const isHeadless = opts.headless || (!forcedInteractive && (!process.stdout.isTTY || !process.stdin.isTTY));

// Check if required args are provided via CLI
function hasRequiredCliArgs(args: typeof opts): boolean {
  return !!(args.url && args.token && args.channel);
}

async function main() {
  // Single-instance guard: if a server is already running, attach to it as a
  // management console instead of booting a second server (which would double
  // every platform connection). "Is a server up?" is decided by connecting to
  // its control socket. Skipped only for the legacy --wizard flow, which must
  // run standalone against config on disk.
  if (!opts.wizard) {
    const existing = await ControlClient.tryConnect();
    if (existing) {
      if (!process.stdout.isTTY || !process.stdin.isTTY) {
        // No TTY to render a console — just report the running instance.
        console.log(
          `claude-threads is already running (pid ${existing.serverPid}, v${existing.serverVersion}). ` +
            `Open an interactive terminal to attach the management console.`,
        );
        existing.close();
        process.exit(0);
      }
      process.stdout.write('\x1b[2J\x1b[H');
      await runConsoleClient(existing);
      process.exit(0);
    }
  }

  // Clear screen for a clean start (only in interactive mode)
  if (!isHeadless) {
    process.stdout.write('\x1b[2J\x1b[H');
  }

  // Determine if we should use auto-restart daemon wrapper
  // Priority: --no-auto-restart (off) > --auto-restart (on) > config.autoUpdate.enabled
  // Note: Commander.js converts --no-auto-restart to opts.autoRestart = false
  const shouldUseAutoRestart = async (): Promise<boolean> => {
    // Explicit CLI flags take precedence
    // opts.autoRestart is: true (--auto-restart), false (--no-auto-restart), or undefined (neither)
    if (opts.autoRestart === false) return false;
    if (opts.autoRestart === true) return true;

    // The daemon wrapper runs the child with piped stdio (bash `&`), so the
    // Ink TUI can't render. When the user has an interactive terminal and
    // hasn't explicitly asked for --headless, skip the daemon so they keep
    // the UI. They can opt in with --auto-restart or run --headless.
    if (!isHeadless && process.stdout.isTTY) return false;

    // Check config for autoUpdate.enabled (if config exists)
    // Default is enabled=true, so only disable if explicitly set to false
    if (await checkConfigExists()) {
      try {
        const config = loadConfigWithMigration();
        if (!config) return false;
        return config.autoUpdate?.enabled !== false;
      } catch {
        return false;
      }
    }
    return false;
  };

  if (await shouldUseAutoRestart()) {
    const { dirname, resolve } = await import('path');
    const { fileURLToPath } = await import('url');

    // Find the daemon wrapper script
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const daemonPath = resolve(__dirname, '..', 'bin', 'claude-threads-daemon');

    // Remove auto-restart flags and add --no-auto-restart to prevent infinite loop
    const args = process.argv.slice(2)
      .filter(arg => arg !== '--auto-restart' && arg !== '--no-auto-restart')
      .concat('--no-auto-restart');

    console.log('🔄 Starting with auto-restart enabled...');
    console.log('');

    // Spawn the daemon wrapper with the remaining args
    // Pass the path to this binary so daemon runs the local version, not global
    // The entry point is dist/index.js (where this code is running from)
    const binPath = __filename;

    // On Windows, the daemon is a bash script that can't be spawned directly.
    // Use bash (from Git for Windows / WSL) if available, otherwise skip daemon.
    let child;
    if (process.platform === 'win32') {
      child = spawn('bash', [daemonPath, '--restart-on-error', ...args], {
        stdio: 'inherit',
        env: {
          ...process.env,
          CLAUDE_THREADS_BIN: binPath,
          // Clear CLAUDE_THREADS_INTERACTIVE so the daemon subprocess detects
          // its own TTY state. The daemon runs with piped stdio (no TTY), so
          // forwarding the parent's TTY state would cause InkProvider to crash.
          CLAUDE_THREADS_INTERACTIVE: '',
        },
      });
    } else {
      child = spawn(daemonPath, ['--restart-on-error', ...args], {
        stdio: 'inherit',
        env: {
          ...process.env,
          CLAUDE_THREADS_BIN: binPath,
          CLAUDE_THREADS_INTERACTIVE: '',
        },
      });
    }

    child.on('error', (err) => {
      if (process.platform === 'win32') {
        console.error(`Failed to start daemon: ${err.message}`);
        console.error('Auto-restart requires bash (Git for Windows or WSL). Starting without auto-restart...');
        console.error('');
        // Continue normal startup without the daemon
        startWithoutDaemon();
        return;
      }
      console.error(`Failed to start daemon: ${err.message}`);
      process.exit(1);
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });

    return; // Don't continue with normal startup
  }

  // Start the bot without the auto-restart daemon wrapper
  await startWithoutDaemon();
}

/**
 * Start the bot directly (without daemon wrapper).
 * This is the normal startup path, also used as fallback when
 * the daemon can't be spawned (e.g., Windows without bash).
 */
async function startWithoutDaemon() {

  // Check for updates (non-blocking, shows notification if available)
  checkForUpdates();

  // Set debug mode from CLI flag
  if (opts.debug) {
    process.env.DEBUG = '1';
  }

  // Validate --permission-mode if provided. Commander passes it through
  // verbatim, so we need to check it's one of the three canonical values.
  if (
    opts.permissionMode !== undefined &&
    !['default', 'auto', 'bypass'].includes(opts.permissionMode)
  ) {
    console.error(red(`  ❌ Invalid --permission-mode: "${opts.permissionMode}". Must be one of: default, auto, bypass.`));
    process.exit(1);
  }

  // Validate the new overhead-visibility flags. Same shape as
  // --permission-mode: commander forwards the raw string, we accept only the
  // three canonical values.
  if (opts.sessionHeader !== undefined && !isOverheadVisibility(opts.sessionHeader)) {
    console.error(red(`  ❌ Invalid --session-header: "${opts.sessionHeader}". Must be one of: ${OVERHEAD_VISIBILITY_VALUES.join(', ')}.`));
    process.exit(1);
  }
  if (opts.stickyMessage !== undefined && !isOverheadVisibility(opts.stickyMessage)) {
    console.error(red(`  ❌ Invalid --sticky-message: "${opts.stickyMessage}". Must be one of: ${OVERHEAD_VISIBILITY_VALUES.join(', ')}.`));
    process.exit(1);
  }

  // Build CLI args object
  const cliArgs: CliArgs = {
    url: opts.url,
    token: opts.token,
    channel: opts.channel,
    botName: opts.botName,
    allowedUsers: opts.allowedUsers,
    skipPermissions: opts.skipPermissions,
    permissionMode: opts.permissionMode as PermissionMode | undefined,
    chrome: opts.chrome,
    worktreeMode: opts.worktreeMode,
    keepAlive: opts.keepAlive,
    sessionHeader: opts.sessionHeader as OverheadVisibility | undefined,
    stickyMessage: opts.stickyMessage as OverheadVisibility | undefined,
  };

  // Onboarding. The legacy step-by-step wizard is now opt-in via --wizard. The
  // default first-run path drops you straight into the management console with
  // an empty config, where [a] adds your first connection via the navigable
  // form (no more restart-on-typo). The wizard remains as a fallback (and for
  // non-interactive first runs, which can't drive the console form).
  if (opts.wizard) {
    await runOnboarding(true); // reconfigure via the legacy wizard
  } else if (!checkConfigExists() && !hasRequiredCliArgs(opts)) {
    if (!process.stdout.isTTY || !process.stdin.isTTY) {
      // No TTY to render the console form → fall back to the wizard.
      await runOnboarding(false);
    } else {
      // Interactive first run: seed a minimal config and boot into the console.
      const defaultConfig = {
        version: 2 as const,
        workingDir: process.cwd(),
        chrome: false,
        worktreeMode: 'prompt' as const,
        platforms: [],
      };
      saveConfig(defaultConfig);
      console.log('');
      console.log('  Starting the management console — press [a] to add your first connection.');
      console.log('');
    }
  }

  const workingDir = process.cwd();
  const newConfig = loadConfigWithMigration();

  if (!newConfig) {
    throw new Error('No configuration found. Run with --wizard to configure, or check file permissions.');
  }

  // CLI args can override global settings
  if (cliArgs.chrome !== undefined) {
    newConfig.chrome = cliArgs.chrome;
  }
  if (cliArgs.worktreeMode !== undefined) {
    newConfig.worktreeMode = cliArgs.worktreeMode;
  }
  if (cliArgs.keepAlive !== undefined) {
    newConfig.keepAlive = cliArgs.keepAlive;
  }
  // Apply overhead-visibility overrides to every platform. These flags are
  // global-scoped (one value, applied everywhere) — the per-platform YAML
  // is the right place when you want different values per platform.
  if (cliArgs.sessionHeader !== undefined) {
    for (const p of newConfig.platforms) {
      p.sessionHeader = cliArgs.sessionHeader;
    }
  }
  if (cliArgs.stickyMessage !== undefined) {
    for (const p of newConfig.platforms) {
      p.stickyMessage = cliArgs.stickyMessage;
    }
  }

  // Determine keep-alive setting (actual setup happens after UI is ready)
  const keepAliveEnabled = newConfig.keepAlive !== false;

  // Zero platforms is a valid, non-fatal state now: it's the first-run bootstrap
  // (add your first connection from the console with [a]) and also what you're
  // left with after removing the last connection at runtime. The console guides
  // the user to add one; we no longer crash.
  if (!newConfig.platforms) {
    newConfig.platforms = [];
  }

  const config = newConfig;

  // Get the first platform's effective permission mode as the default
  // (for backwards compatibility with single-platform setups). Precedence:
  // --permission-mode CLI flag > --skip-permissions / --no-skip-permissions
  // (legacy) > platform config's `permissionMode` > platform config's legacy
  // `skipPermissions` > 'default' (safe fallback). Undefined when there are no
  // platforms yet — the resolver falls back to a safe default.
  const firstPlatformConfig = config.platforms[0] as
    | MattermostPlatformConfig
    | SlackPlatformConfig
    | undefined;
  const initialPermissionMode: PermissionMode = resolvePermissionMode({
    permissionMode:
      cliArgs.permissionMode
      ?? firstPlatformConfig?.permissionMode,
    skipPermissions:
      cliArgs.skipPermissions
      ?? firstPlatformConfig?.skipPermissions,
  });

  // Which backends does this config actually use? A bot configured entirely
  // for opencode must not be blocked by a missing/incompatible Claude CLI, and
  // vice versa.
  const backendsInUse = new Set(
    config.platforms.map((p) => resolveAgentBackend(p.agent, `platforms[${p.id}].agent`)),
  );

  // Check Claude CLI version (always computed for the startup/status display).
  const claudeValidation = validateClaudeCli();

  // Fail on incompatible version unless --skip-version-check is set — but only
  // when at least one platform actually runs on Claude.
  if (backendsInUse.has('claude') && !claudeValidation.compatible && !opts.skipVersionCheck) {
    console.error(red(`  ❌ ${claudeValidation.message}`));
    console.error('');
    console.error(dim(`  Use --skip-version-check to bypass this check (not recommended)`));
    console.error('');
    process.exit(1);
  }

  // Check the opencode binary when any platform uses it. Non-fatal: a mixed
  // deployment's Claude platforms should still start, and opencode sessions
  // surface their own error if the server can't be spawned.
  if (backendsInUse.has('opencode')) {
    const opencodeValidation = validateOpencode();
    if (!opencodeValidation.compatible) {
      console.error(red(`  ⚠️  ${opencodeValidation.message}`));
      console.error(dim('     opencode-backed sessions will not work until this is resolved.'));
      console.error('');
    } else {
      console.log(dim(`  ✓ ${opencodeValidation.message}`));
    }
  }

  // Warn on an incompatible env + config combo: CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1
  // forces Claude CLI into permissionMode: default and rejects
  // --dangerously-skip-permissions (verified on CLI 2.1.116). If any platform is
  // configured with skipPermissions: true, the user will see repeated warnings
  // from Claude and their sessions won't behave as configured.
  if (process.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB === '1') {
    const hasSkipPermissionPlatform = config.platforms.some(
      (p) => (p as MattermostPlatformConfig | SlackPlatformConfig).skipPermissions === true
    );
    if (hasSkipPermissionPlatform) {
      console.error(
        red('  ⚠️  CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1 is set but a platform has skipPermissions: true.')
      );
      console.error(
        dim('     Claude CLI will force permissionMode: default and reject --dangerously-skip-permissions.')
      );
      console.error(
        dim('     Either unset the env var or set skipPermissions: false on all platforms.')
      );
      console.error('');
    }
  }

  // Mutable reference for shutdown - set after all components initialized
  let triggerShutdown: (() => void) | null = null;

  // React 19 buffers a PerformanceMeasure per re-render on Node.js 25+, which
  // leaks until OOM. Nothing reads these entries, so drop them on a timer.
  // See src/utils/perf-cleanup.ts for the full rationale and safety notes.
  startReactMeasureCleanup();

  // Check if this is a daemon restart after update - restore runtime settings if so
  const updateState = loadUpdateState();
  const restoredSettings = updateState.justUpdated ? updateState.runtimeSettings : undefined;
  if (restoredSettings) {
    // Clear settings after reading so next manual start uses config defaults
    clearRuntimeSettings();
    // Restore debug mode if it was enabled
    if (restoredSettings.debugEnabled) {
      process.env.DEBUG = '1';
    }
  }

  // Mutable runtime config (can be changed via keyboard toggles)
  // These affect new sessions and sticky message display.
  // On daemon restart, restore previous settings; otherwise use config
  // defaults. `permissionMode` is the source of truth; `skipPermissions` is
  // the derived boolean kept around for any legacy persisted-settings reader.
  const restoredPermissionMode: PermissionMode = restoredSettings?.permissionMode
    ?? (restoredSettings?.skipPermissions === true ? 'bypass'
      : restoredSettings?.skipPermissions === false ? 'default'
      : initialPermissionMode);
  const runtimeConfig = {
    permissionMode: restoredPermissionMode,
    skipPermissions: restoredPermissionMode === 'bypass',
    chromeEnabled: restoredSettings?.chromeEnabled ?? (config.chrome ?? false),
    keepAliveEnabled: restoredSettings?.keepAliveEnabled ?? keepAliveEnabled,
  };

  // Session manager reference (set after UI is ready)
  let sessionManager: SessionManager | null = null;

  // Auto-update manager reference
  let autoUpdateManager: AutoUpdateManager | null = null;

  // Session store for persistence (created early so toggle callbacks can use it)
  const sessionStore = new SessionStore();

  // App config, shared by the local UI and the control-socket snapshot.
  const appConfig: AppConfig = {
    version: VERSION,
    workingDir,
    claudeVersion: claudeValidation.version || 'unknown',
    claudeCompatible: claudeValidation.compatible,
    permissionMode: runtimeConfig.permissionMode,
    chromeEnabled: runtimeConfig.chromeEnabled,
    keepAliveEnabled: runtimeConfig.keepAliveEnabled,
  };

  // The UIProvider the rest of this function talks to. Assigned below as the
  // ServerBridge-wrapped provider so every mutation also broadcasts to any
  // attached management consoles. The toggle callbacks defined below close over
  // it and run only after assignment, so the forward reference is safe — hence
  // `let` with a deferred assignment rather than `const`.
  // eslint-disable-next-line prefer-const
  let ui: UIProvider;

  // Control server (single-instance / management-console channel). Assigned
  // after the provider is wrapped; closed on shutdown.
  let bridge: ServerBridge | null = null;

  // The real toggle callbacks (unchanged logic). The bridge wraps these so a
  // toggle flipped locally or by a remote console stays consistent everywhere.
  const baseToggleCallbacks: ToggleCallbacks = {
      onDebugToggle: (enabled) => {
        // process.env.DEBUG is already updated in App.tsx
        // Persist for daemon restart
        saveRuntimeSettings({ ...getRuntimeSettings(), debugEnabled: enabled });
        ui.addLog({ level: 'info', component: 'toggle', message: `Debug mode ${enabled ? 'enabled' : 'disabled'}` });
        // Trigger sticky message update to reflect debug state
        sessionManager?.updateAllStickyMessages();
      },
      onPermissionsToggle: (mode) => {
        runtimeConfig.permissionMode = mode;
        // Persist for daemon restart. We also write the legacy
        // `skipPermissions` boolean (derived) so older daemon-restart paths
        // that still read it keep working; precedence in resolvePermissionMode
        // keeps `permissionMode` authoritative on next startup.
        saveRuntimeSettings({
          ...getRuntimeSettings(),
          permissionMode: mode,
          skipPermissions: mode === 'bypass',
        });
        // Update ALL platform configs so new sessions use this setting.
        for (const platformConfig of config.platforms) {
          const pc = platformConfig as MattermostPlatformConfig | SlackPlatformConfig;
          pc.permissionMode = mode;
          pc.skipPermissions = mode === 'bypass';
        }
        // Update SessionManager's internal state for sticky message
        sessionManager?.setPermissionMode(mode);
        ui.addLog({ level: 'info', component: 'toggle', message: `Permission mode: ${mode}` });
        sessionManager?.updateAllStickyMessages();
      },
      onChromeToggle: (enabled) => {
        runtimeConfig.chromeEnabled = enabled;
        config.chrome = enabled;
        // Persist for daemon restart
        saveRuntimeSettings({ ...getRuntimeSettings(), chromeEnabled: enabled });
        // Update SessionManager's internal state for sticky message
        sessionManager?.setChromeEnabled(enabled);
        ui.addLog({ level: 'info', component: 'toggle', message: `Chrome integration ${enabled ? 'enabled' : 'disabled'} for new sessions` });
        sessionManager?.updateAllStickyMessages();
      },
      onKeepAliveToggle: (enabled) => {
        runtimeConfig.keepAliveEnabled = enabled;
        keepAlive.setEnabled(enabled);
        // Persist for daemon restart
        saveRuntimeSettings({ ...getRuntimeSettings(), keepAliveEnabled: enabled });
        ui.addLog({ level: 'info', component: 'toggle', message: `Keep-alive ${enabled ? 'enabled' : 'disabled'}` });
        sessionManager?.updateAllStickyMessages();
      },
      onPlatformToggle: async (platformId, enabled) => {
        // A connection may have several channels → several clients ("base#chan").
        // Toggle every client that belongs to the connection.
        const subIds = Array.from(platforms.keys()).filter((pid) => belongsToConnection(pid, platformId));
        if (subIds.length === 0) {
          ui.addLog({ level: 'error', component: 'toggle', message: `Platform ${platformId} not found` });
          return;
        }

        if (enabled) {
          ui.addLog({ level: 'info', component: 'toggle', message: `Enabling platform ${platformId}...` });
          for (const pid of subIds) {
            const client = platforms.get(pid);
            if (!client) continue;
            try {
              client.prepareForReconnect();
              await client.connect();
              sessionStore.setPlatformEnabled(pid, true);
              await sessionManager?.resumePausedSessionsForPlatform(pid);
            } catch (err) {
              ui.addLog({ level: 'error', component: 'toggle', message: `Failed to reconnect ${pid}: ${err}` });
              ui.setPlatformStatus(pid, { enabled: false });
            }
          }
          ui.addLog({ level: 'info', component: 'toggle', message: `✓ Platform ${platformId} reconnected` });
        } else {
          ui.addLog({ level: 'info', component: 'toggle', message: `Disabling platform ${platformId}...` });
          for (const pid of subIds) {
            const client = platforms.get(pid);
            if (!client) continue;
            await sessionManager?.pauseSessionsForPlatform(pid);
            client.disconnect();
            sessionStore.setPlatformEnabled(pid, false);
            ui.setPlatformStatus(pid, { connected: false, reconnecting: false });
          }
          ui.addLog({ level: 'info', component: 'toggle', message: `✓ Platform ${platformId} disabled` });
        }
      },
      onForceUpdate: () => {
        if (autoUpdateManager?.hasUpdate()) {
          ui.addLog({ level: 'info', component: 'update', message: '🚀 Force updating via Shift+U...' });
          autoUpdateManager.forceUpdate().catch((err) => {
            ui.addLog({ level: 'error', component: 'update', message: `Force update failed: ${err}` });
          });
        } else {
          ui.addLog({ level: 'info', component: 'update', message: 'No update available to install' });
        }
      },
  };

  // Management actions triggered from the local TUI or a remote console. The
  // console sends the composite session id ("platformId:threadId"); split it
  // and route to the SessionManager (attributed to a synthetic "console" user).
  const splitSessionId = (id: string): { platformId?: string; threadId: string } => {
    const idx = id.indexOf(':');
    return idx === -1
      ? { threadId: id }
      : { platformId: id.slice(0, idx), threadId: id.slice(idx + 1) };
  };
  const serverActions = {
    cancelSession: (sessionId: string) => {
      const { platformId, threadId } = splitSessionId(sessionId);
      ui.addLog({ level: 'info', component: 'console', message: `Stop session ${sessionId}` });
      void sessionManager?.cancelSession(threadId, 'console', platformId);
    },
    interruptSession: (sessionId: string) => {
      const { platformId, threadId } = splitSessionId(sessionId);
      ui.addLog({ level: 'info', component: 'console', message: `Interrupt session ${sessionId}` });
      void sessionManager?.interruptSession(threadId, 'console', platformId);
    },
  };

  // Wrap the provider + callbacks with the control-socket bridge, then start
  // the real UI (Ink or headless) with the wrapped callbacks. `ui` (used above
  // by the callbacks) is the bridge-wrapped provider, so every mutation it
  // makes is also broadcast to attached management consoles.
  // Redacted view of the configured connections for the console edit form —
  // secrets are stripped so tokens never travel to (or render in) a console.
  const redactConnection = (p: PlatformInstanceConfig): PlatformInstanceConfig => {
    const clone = { ...p } as Record<string, unknown>;
    for (const k of ['token', 'botToken', 'appToken']) {
      if (k in clone) clone[k] = '';
    }
    return clone as unknown as PlatformInstanceConfig;
  };
  const getConnections = (): PlatformInstanceConfig[] => config.platforms.map(redactConnection);

  // Global settings: read the editable subset; save persists + applies the two
  // hot fields (chrome, keep-alive), the rest take effect on restart.
  const getSettings = (): EditableGlobalSettings => pickGlobalSettings(config);
  const saveSettings = (s: EditableGlobalSettings): void => {
    applyGlobalSettings(config, s);
    saveConfig(config);
    // Hot-apply what we safely can at runtime.
    runtimeConfig.chromeEnabled = s.chrome;
    sessionManager?.setChromeEnabled(s.chrome);
    runtimeConfig.keepAliveEnabled = s.keepAlive;
    keepAlive.setEnabled(s.keepAlive);
    ui.addLog({
      level: 'info',
      component: 'settings',
      message:
        'Global settings saved. Chrome + keep-alive applied live; working dir / worktree mode / limits / logs take effect on restart.',
    });
    sessionManager?.updateAllStickyMessages();
  };

  bridge = new ServerBridge({
    version: VERSION,
    config: appConfig,
    callbacks: baseToggleCallbacks,
    actions: serverActions,
    getConnections,
    getSettings,
    onSaveSettings: saveSettings,
    onServerStop: () => {
      if (triggerShutdown) triggerShutdown();
    },
    log: (msg) => ui.addLog({ level: 'debug', component: 'ipc', message: msg }),
  });

  const innerUi: UIProvider = await startUI({
    config: appConfig,
    headless: isHeadless,
    mode: 'server',
    // "Leave console — keep server running": re-launch the server detached in
    // the background (headless) and exit this foreground process. Sessions
    // resume from persistence, exactly like an auto-update restart.
    onLeave: () => void detachToBackground(),
    // "Quit server": full graceful shutdown.
    onStopServer: () => {
      if (triggerShutdown) triggerShutdown();
    },
    toggleCallbacks: bridge.wrapCallbacks(),
    actionCallbacks: {
      onSessionCancel: serverActions.cancelSession,
      onSessionInterrupt: serverActions.interruptSession,
      onServerStop: () => {
        if (triggerShutdown) triggerShutdown();
      },
      // Local-TUI connection management routes straight to the hot-reload
      // closures declared further below (invoked later, so the reference is
      // safe). Remote consoles reach the same closures via the control socket.
      onConnectionSave: (cfg) => void addOrUpdateConnection(cfg as PlatformInstanceConfig),
      onConnectionRemove: (id) => void removeConnection(id),
    },
    getConnections,
    getSettings,
    onSettingsSave: (s) => saveSettings(s as EditableGlobalSettings),
  });
  ui = bridge.wrapProvider(innerUi);

  // Open the control socket so a second `claude-threads` invocation attaches as
  // a management console instead of starting a second server. Non-fatal: the
  // bot still runs if the socket can't be opened.
  try {
    await bridge.listen();
  } catch (err) {
    innerUi.addLog({
      level: 'warn',
      component: 'ipc',
      message: `Control socket unavailable (console attach disabled): ${err}`,
    });
  }

  // Route all logger output through the UI
  setLogHandler((level, component, message, sessionId) => {
    ui.addLog({ level, component, message, sessionId });
  });

  // Now that log handler is set, enable keep-alive (will route logs through UI)
  keepAlive.setEnabled(keepAliveEnabled);

  // Create session manager (shared across all platforms).
  // Pass the resolved permission mode string (not the legacy boolean) so the
  // manager tracks all three modes correctly.
  const threadLogsEnabled = config.threadLogs?.enabled ?? true;
  const threadLogsRetentionDays = config.threadLogs?.retentionDays ?? 30;
  const session = new SessionManager(
    workingDir,
    initialPermissionMode,
    config.chrome,
    config.worktreeMode,
    undefined,  // sessionsPath - use default
    threadLogsEnabled,
    threadLogsRetentionDays,
    config.limits,  // Resource limits (optional, has sensible defaults)
    config.claudeAccounts,  // Claude account pool (undefined = single-account mode)
    config.respondOnlyWhenMentioned,  // Quiet-mode default for new sessions (#402)
    config.maxBotHandoffs  // Cap on consecutive bot-to-bot handoffs (undefined → default)
  );

  // Set sticky message customization from config
  if (config.stickyMessage) {
    session.setStickyMessageCustomization(config.stickyMessage.description, config.stickyMessage.footer);
  }

  // Set reference for toggle callbacks
  sessionManager = session;

  // Wire up session events to UI (shared across all platforms)
  session.on('session:add', (info) => {
    ui.addSession(info);
  });
  session.on('session:update', (sessionId, updates) => {
    ui.updateSession(sessionId, updates);
  });
  session.on('session:remove', (sessionId) => {
    ui.removeSession(sessionId);
  });

  // Store all platform clients for shutdown
  const platforms = new Map<string, PlatformClient>();

  // Load persisted platform enabled states (sessionStore created earlier for toggle callbacks)
  const platformEnabledState = sessionStore.getPlatformEnabledState();

  // Register a platform's UI status, client, session-manager wiring and event
  // wiring. Extracted from the init loop so runtime hot-add (a management
  // console adding a connection) reuses the exact same setup — no full restart.
  const registerPlatform = (platformConfig: PlatformInstanceConfig, isEnabled: boolean): PlatformClient => {
    const typedConfig = platformConfig as MattermostPlatformConfig | SlackPlatformConfig;

    // Register platform with UI (with persisted enabled state)
    ui.setPlatformStatus(platformConfig.id, {
      displayName: platformConfig.displayName || platformConfig.id,
      botName: typedConfig.botName,
      url: typedConfig.type === 'mattermost' ? (typedConfig as MattermostPlatformConfig).url : 'slack.com',
      platformType: typedConfig.type as 'mattermost' | 'slack',
      enabled: isEnabled,
    });

    // Create platform client using factory
    const client = createPlatformClient(platformConfig);
    platforms.set(platformConfig.id, client);

    // Register with session manager (passes per-platform overhead visibility)
    session.addPlatform(platformConfig.id, client, {
      sessionHeader: resolveOverheadVisibility(
        platformConfig.sessionHeader,
        `platforms[${platformConfig.id}].sessionHeader`,
      ),
      stickyMessage: resolveOverheadVisibility(
        platformConfig.stickyMessage,
        `platforms[${platformConfig.id}].stickyMessage`,
      ),
    }, resolveAgentBackend(
      platformConfig.agent,
      `platforms[${platformConfig.id}].agent`,
    ), typeof platformConfig.model === 'string' ? platformConfig.model : undefined,
    typeof platformConfig.description === 'string' ? platformConfig.description : undefined,
    typeof platformConfig.workingDir === 'string' ? platformConfig.workingDir : undefined,
    isWorkingBlockMode(platformConfig.workingBlock) ? platformConfig.workingBlock : undefined,
    isWriteScopeMode(platformConfig.writeScope) ? platformConfig.writeScope : undefined);

    // Wire up platform events
    wirePlatformEvents(platformConfig.id, client, session, ui);
    return client;
  };

  // Initialize all configured platforms. A connection with several channels is
  // expanded into one single-channel client per channel (sub-id "base#chan"),
  // so the platform clients stay strictly single-channel. Enabled state is
  // keyed by the base connection id and inherited by every sub-client.
  ui.addLog({ level: 'debug', component: 'init', message: `Initializing ${config.platforms.length} connection(s)` });
  for (const platformConfig of config.platforms) {
    const isEnabled = platformEnabledState.get(platformConfig.id) ?? true; // Default to enabled
    for (const sub of expandPlatformChannels(platformConfig)) {
      ui.addLog({ level: 'info', component: 'init', message: `Creating ${sub.type} platform: ${sub.id}${isEnabled ? '' : ' (disabled)'}` });
      registerPlatform(sub, isEnabled);
    }
  }

  // Connect only enabled platforms
  const enabledPlatforms = Array.from(platforms.entries()).filter(
    ([id]) => platformEnabledState.get(id) ?? true
  );
  const disabledCount = platforms.size - enabledPlatforms.length;
  ui.addLog({ level: 'info', component: 'init', message: `Connecting ${enabledPlatforms.length} platform(s)...${disabledCount > 0 ? ` (${disabledCount} disabled)` : ''}` });
  const connectionResults = await Promise.allSettled(
    enabledPlatforms.map(async ([id, client]) => {
      ui.addLog({ level: 'debug', component: 'init', message: `Connecting to ${id}...` });
      try {
        await client.connect();
        ui.addLog({ level: 'info', component: 'init', message: `✓ Connected to ${id}` });
        return { id, success: true };
      } catch (err) {
        ui.addLog({ level: 'error', component: 'init', message: `✗ Failed to connect to ${id}: ${err}` });
        // Mark the platform as disabled so we don't try to use it
        platformEnabledState.set(id, false);
        return { id, success: false, error: err };
      }
    })
  );

  // Check if at least one platform connected successfully
  const successfulConnections = connectionResults.filter(
    (r) => r.status === 'fulfilled' && r.value.success
  );
  if (successfulConnections.length === 0) {
    ui.addLog({ level: 'error', component: 'init', message: '⚠️ No platforms connected. Check your configuration and credentials.' });
  }

  // ---------------------------------------------------------------------------
  // Runtime connection management (per-client hot-reload)
  //
  // Adding/updating/removing a connection touches ONLY the affected platform
  // client — other sessions keep running. The config is persisted so the change
  // survives a restart.
  // ---------------------------------------------------------------------------

  // Tear down every client belonging to a connection (a multi-channel
  // connection has one client per channel: "base#chan").
  const teardownConnection = async (baseId: string): Promise<void> => {
    const subIds = Array.from(platforms.keys()).filter((pid) => belongsToConnection(pid, baseId));
    for (const pid of subIds) {
      // Pause active sessions so they can resume after the client comes back
      // (an update) or stay parked (a removal).
      await session.pauseSessionsForPlatform(pid).catch(() => {});
      await platforms.get(pid)?.disconnect().catch(() => {});
      session.removePlatform(pid);
      platforms.delete(pid);
    }
  };

  const addOrUpdateConnection = async (
    platformConfig: PlatformInstanceConfig,
  ): Promise<{ ok: boolean; error?: string }> => {
    const id = platformConfig.id;
    try {
      const idx = config.platforms.findIndex((p) => p.id === id);
      const isUpdate = idx >= 0;
      if (isUpdate) {
        ui.addLog({ level: 'info', component: 'connection', message: `Updating connection ${id}…` });
        await teardownConnection(id);
      } else {
        ui.addLog({ level: 'info', component: 'connection', message: `Adding connection ${id}…` });
      }

      // Preserve secrets on edit: a console never receives the real token
      // (it's redacted), so an empty incoming secret means "keep the existing
      // one" rather than wiping it.
      if (isUpdate) {
        const existingCfg = config.platforms[idx] as unknown as Record<string, unknown>;
        const incoming = platformConfig as unknown as Record<string, unknown>;
        for (const k of ['token', 'botToken', 'appToken']) {
          if (!incoming[k] && existingCfg[k]) incoming[k] = existingCfg[k];
        }
      }

      // Upsert the (single, possibly multi-channel) connection entry + persist.
      if (idx >= 0) config.platforms[idx] = platformConfig;
      else config.platforms.push(platformConfig);
      saveConfig(config);

      // Expand into one single-channel client per channel; register + connect each.
      for (const sub of expandPlatformChannels(platformConfig)) {
        const client = registerPlatform(sub, true);
        await client.connect();
        sessionStore.setPlatformEnabled(sub.id, true);
        // Resume any sessions parked by an update (no-op for a brand-new platform).
        await session.resumePausedSessionsForPlatform(sub.id).catch(() => {});
      }
      ui.addLog({ level: 'info', component: 'connection', message: `✓ Connection ${id} live` });
      bridge?.broadcastConnections();
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      ui.addLog({ level: 'error', component: 'connection', message: `✗ Connection ${id} failed: ${error}` });
      return { ok: false, error };
    }
  };

  const removeConnection = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const idx = config.platforms.findIndex((p) => p.id === id);
      const hasClients = Array.from(platforms.keys()).some((pid) => belongsToConnection(pid, id));
      if (idx < 0 && !hasClients) {
        return { ok: false, error: `No such connection: ${id}` };
      }
      ui.addLog({ level: 'info', component: 'connection', message: `Removing connection ${id}…` });
      await teardownConnection(id);
      if (idx >= 0) {
        config.platforms.splice(idx, 1);
        saveConfig(config);
      }
      ui.addLog({ level: 'info', component: 'connection', message: `✓ Connection ${id} removed` });
      bridge?.broadcastConnections();
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      ui.addLog({ level: 'error', component: 'connection', message: `✗ Remove ${id} failed: ${error}` });
      return { ok: false, error };
    }
  };

  // Expose runtime connection management to the control channel (management
  // console). Registered after the platform machinery exists.
  bridge?.setConnectionHandlers({ addOrUpdateConnection, removeConnection });

  // Resume any persisted sessions from before restart
  await session.initialize();

  // Shutdown flag - shared between shutdown() and prepareForRestart callback
  let isShuttingDown = false;

  // Graceful pre-restart handoff: persist sessions, stop timers, close the
  // control socket and disconnect platforms so a fresh process can take over
  // cleanly (sessions resume from persistence). Used by auto-update restarts
  // AND by "leave console — keep server running" (detach to background).
  const prepareForRestart = async (): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    ui.setShuttingDown();
    session.setShuttingDown();
    await session.updateAllStickyMessages();
    await session.killAllSessions();
    autoUpdateManager?.stop();

    // Close the control socket before the new process starts, so it can re-open
    // it without racing a stale socket.
    await bridge?.close('server restarting');

    // Await disconnects so the new process can re-establish websockets without
    // racing the old one (self-respawn starts the child within milliseconds).
    await Promise.all(
      Array.from(platforms.values()).map((client) =>
        client.disconnect().catch((err) => {
          ui.addLog({ level: 'warn', component: 'shutdown', message: `disconnect failed: ${err}` });
        })
      )
    );

    if (!isHeadless) {
      process.stdout.write('\x1b[2J\x1b[H');
      process.stdout.write('\x1b[?25h');
    }
  };

  // "Leave console — keep server running" for a foreground server: a running
  // Node process can't daemonize itself, so we re-launch detached & headless,
  // hand off via prepareForRestart, and exit. The child boots as the (now
  // sole) server and resumes persisted sessions.
  const detachToBackground = async (): Promise<void> => {
    // Re-exec the SAME binary we're running (process.execPath + entry script) —
    // not `claude-threads` on PATH. This keeps a repo build (`bun start` /
    // `bun run dev`) from accidentally relaunching a different, globally
    // installed version in the background. (Auto-update respawn deliberately
    // uses the PATH binary — that's the freshly-installed one; detach is not.)
    const entry = process.argv[1];
    if (!entry) {
      ui.addLog({
        level: 'error',
        component: 'console',
        message: 'Cannot determine own entry point — staying attached. Use "Quit server" or Ctrl+C.',
      });
      return;
    }
    ui.addLog({ level: 'info', component: 'console', message: 'Detaching — server continues in the background…' });
    await prepareForRestart();
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    delete childEnv.CLAUDE_THREADS_BIN;
    delete childEnv.CLAUDE_THREADS_INTERACTIVE;
    try {
      const child = spawn(process.execPath, [entry, '--headless', '--no-auto-restart'], {
        detached: true,
        stdio: 'ignore',
        env: childEnv,
      });
      child.unref();
    } catch {
      // Torn down already; exit regardless so we don't sit half-shut-down.
    }
    process.exit(0);
  };

  // Initialize auto-update manager
  autoUpdateManager = new AutoUpdateManager(config.autoUpdate, {
    getSessionActivity: () => session.getActivityInfo(),
    getActiveThreadIds: () => session.getActiveThreadIds(),
    broadcastUpdate: (msg) => session.broadcastToAll(msg),
    postAskMessage: (ids, ver) => session.postUpdateAskMessage(ids, ver),
    refreshUI: () => session.updateAllStickyMessages(),
    prepareForRestart,
  });

  // Connect auto-update manager to session manager for !update commands
  session.setAutoUpdateManager(autoUpdateManager);

  // Wire up auto-update events to UI
  autoUpdateManager.on('update:available', (info) => {
    ui.addLog({ level: 'info', component: 'update', message: `🆕 Update available: v${info.currentVersion} → v${info.latestVersion}` });
    ui.setUpdateState({
      status: 'available',
      currentVersion: info.currentVersion,
      latestVersion: info.latestVersion,
    });
  });

  autoUpdateManager.on('update:countdown', (seconds) => {
    if (seconds === 60 || seconds === 30 || seconds === 10 || seconds <= 5) {
      ui.addLog({ level: 'info', component: 'update', message: `🔄 Restarting in ${seconds} seconds...` });
    }
    // Update scheduled restart time
    const restartAt = autoUpdateManager?.getScheduledRestartAt();
    const updateInfo = autoUpdateManager?.getUpdateInfo();
    if (restartAt) {
      ui.setUpdateState({
        status: 'scheduled',
        currentVersion: VERSION,
        latestVersion: updateInfo?.latestVersion,
        scheduledRestartAt: restartAt,
      });
    }
  });

  autoUpdateManager.on('update:status', (status, message) => {
    if (message) {
      ui.addLog({ level: 'info', component: 'update', message: `🔄 ${status}: ${message}` });
    }
    // Map auto-update status to UI status
    const updateInfo = autoUpdateManager?.getUpdateInfo();
    const state = autoUpdateManager?.getState();
    ui.setUpdateState({
      status: status as 'idle' | 'available' | 'scheduled' | 'installing' | 'pending_restart' | 'failed' | 'deferred',
      currentVersion: VERSION,
      latestVersion: updateInfo?.latestVersion,
      scheduledRestartAt: autoUpdateManager?.getScheduledRestartAt() ?? undefined,
      errorMessage: state?.errorMessage,
    });
  });

  autoUpdateManager.on('update:failed', (error) => {
    ui.addLog({ level: 'error', component: 'update', message: `❌ Update failed: ${error}` });
    ui.setUpdateState({
      status: 'failed',
      currentVersion: VERSION,
      latestVersion: autoUpdateManager?.getUpdateInfo()?.latestVersion,
      errorMessage: error,
    });
  });

  // Initialize update state
  ui.setUpdateState({
    status: 'idle',
    currentVersion: VERSION,
  });

  // Start auto-update system
  autoUpdateManager.start();

  // Mark UI as ready
  ui.setReady();

  const shutdown = async (_signal: string) => {
    // Guard against multiple shutdown calls (SIGINT + SIGTERM)
    if (isShuttingDown) return;
    isShuttingDown = true;

    // Update status bar to show shutdown in progress
    ui.setShuttingDown();

    // Give React a moment to render the shutdown state
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Set shutdown flag FIRST to prevent race conditions with exit events
    session.setShuttingDown();

    // Update sticky messages to show shutdown state
    await session.updateAllStickyMessages();

    // Post shutdown message to active sessions (updates existing timeout posts or creates new ones)
    const activeCount = session.getActiveThreadIds().length;
    if (activeCount > 0) {
      ui.addLog({ level: 'info', component: '📤', message: `Notifying ${activeCount} active session(s)...` });
      await session.postShutdownMessages();
    }

    await session.killAllSessions();

    // Shut down the shared opencode server (if one was started for any
    // opencode-backed session). No-op when no opencode session ever ran.
    await opencodeServer.shutdown();

    // Shut down the in-process MCP host (send_file/read_post for opencode
    // bots). No-op when never started.
    await opencodeMcpHost.shutdown();

    // Stop auto-update manager
    autoUpdateManager?.stop();

    // Close the control socket (detaches any attached management consoles).
    await bridge?.close('server shutting down');

    // Disconnect all platforms
    for (const client of platforms.values()) {
      client.disconnect();
    }

    // Clear screen and restore cursor for clean exit (only in interactive mode)
    if (!isHeadless) {
      process.stdout.write('\x1b[2J\x1b[H');  // Clear screen, cursor to home
      process.stdout.write('\x1b[?25h');       // Restore cursor visibility
    }
    // Don't call process.exit() here - let the signal handler do it after we resolve
  };

  // Wire up the Ctrl+C handler from UI to shutdown
  triggerShutdown = () => {
    shutdown('Ctrl+C').finally(() => process.exit(0));
  };

  // Remove any existing signal handlers (e.g., from 'when-exit' package)
  // and register our own to ensure graceful shutdown
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('SIGTERM');

  process.on('SIGINT', () => {
    shutdown('SIGINT').finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM').finally(() => process.exit(0));
  });
}

main().catch(e => { console.error(e); process.exit(1); });
