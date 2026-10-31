/**
 * Control-channel IPC: single-instance detection + management-console attach.
 *
 * A second `claude-threads` invocation connects to the running server's control
 * socket and runs as a management console instead of booting a second server.
 */
export { ControlServer } from './server.js';
export { ControlClient } from './client.js';
export { ServerBridge } from './server-bridge.js';
export { runConsoleClient } from './console.js';
export { controlSocketPath, controlLockPath, controlDir } from './paths.js';
export type {
  ServerEvent,
  ClientCommand,
  Snapshot,
} from './protocol.js';
export type { ServerBridgeOptions, ServerActionHandlers, ConnectionHandlers } from './server-bridge.js';
