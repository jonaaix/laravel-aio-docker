/**
 * IPC endpoint paths for the control channel.
 *
 * The control channel lets a second `claude-threads` invocation attach to an
 * already-running instance as a management console instead of booting a second
 * server. We use a Unix domain socket on POSIX and a named pipe on Windows.
 *
 * Liveness is decided by *connecting* to the socket, not by the lockfile — the
 * lockfile is advisory (diagnostics + stale-socket cleanup only). See
 * `ControlClient.tryConnect` / `ControlServer.listen`.
 */
import { homedir } from 'os';
import { resolve, dirname } from 'path';
import { createHash } from 'crypto';

/** Directory that also holds config.yaml / sessions.json (mode 0700). */
export function controlDir(): string {
  return resolve(homedir(), '.config', 'claude-threads');
}

/**
 * Path/address the control server listens on.
 *
 * - POSIX: a real filesystem socket under the config dir.
 * - Windows: a named pipe. Named pipes don't live on disk, so we derive a
 *   stable, per-user name by hashing the home directory (keeps two users on
 *   one machine from colliding).
 */
export function controlSocketPath(): string {
  if (process.platform === 'win32') {
    const tag = createHash('sha1').update(homedir()).digest('hex').slice(0, 12);
    return `\\\\.\\pipe\\claude-threads-${tag}`;
  }
  return resolve(controlDir(), 'control.sock');
}

/** Advisory lockfile describing the current server (PID, version, socket). */
export function controlLockPath(): string {
  return resolve(controlDir(), 'control.lock');
}

export { dirname };
