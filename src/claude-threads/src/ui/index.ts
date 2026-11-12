/**
 * UI entry point - exports startUI() function
 */
import { createUIProvider, type UIProvider, type StartUIOptions, type UISeedState } from './providers/index.js';
import type { AppConfig, SessionInfo, LogEntry, PlatformStatus, ToggleState, ToggleCallbacks, UpdatePanelState } from './types.js';

export type { UIProvider, StartUIOptions, UISeedState, AppConfig, SessionInfo, LogEntry, PlatformStatus, ToggleState, ToggleCallbacks, UpdatePanelState };

export async function startUI(options: StartUIOptions): Promise<UIProvider> {
  return createUIProvider(options);
}
