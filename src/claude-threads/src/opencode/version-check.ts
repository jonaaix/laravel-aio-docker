/**
 * opencode binary discovery + version compatibility check.
 *
 * The bot spawns `opencode serve` (via `@opencode-ai/sdk`'s
 * `createOpencodeServer`), so the `opencode` binary must be on PATH and speak a
 * protocol compatible with the bundled SDK. opencode's CLI and its SDK are
 * versioned in lockstep, so we gate the host binary against the SDK's version
 * line. Lighter than the Claude check — no per-account credential model.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { satisfies, coerce } from 'semver';

/**
 * Compatible opencode version range. The bundled `@opencode-ai/sdk` is on the
 * 1.18.x line; opencode's server API is generated from the same release, so we
 * require the host binary to be on the same major line. Bump this in lockstep
 * when upgrading the SDK dependency in package.json. (Verified: bundled SDK
 * 1.18.3 against host opencode 1.18.3, and cross-minor 1.17.x↔1.18.x, via the
 * opt-in E2E in agent.e2e.test.ts.)
 */
export const OPENCODE_VERSION_RANGE = '>=1.17.0 <2.0.0';

/** The SDK version we ship against — surfaced in the "please update" message. */
const BUNDLED_SDK_VERSION = '1.18.3';

const COMMON_OPENCODE_PATHS: string[] = process.platform === 'win32'
  ? [
    ...(process.env.APPDATA ? [join(process.env.APPDATA, 'npm', 'opencode.cmd')] : []),
    ...(process.env.LOCALAPPDATA ? [join(process.env.LOCALAPPDATA, 'npm', 'opencode.cmd')] : []),
    ...(process.env.USERPROFILE ? [join(process.env.USERPROFILE, '.opencode', 'bin', 'opencode.exe')] : []),
    ...(process.env.USERPROFILE ? [join(process.env.USERPROFILE, '.bun', 'bin', 'opencode.cmd')] : []),
  ]
  : [
    `${process.env.HOME}/.opencode/bin/opencode`,
    '/usr/local/bin/opencode',
    '/opt/homebrew/bin/opencode',
    `${process.env.HOME}/.local/bin/opencode`,
    `${process.env.HOME}/.bun/bin/opencode`,
  ];

/**
 * Resolve the `opencode` binary path. Order: `OPENCODE_PATH` env → `which/where`
 * on PATH → common install locations → the bare name `opencode` (let the OS
 * resolve, matching what the SDK does when it spawns the server).
 */
export function getOpencodePath(): string {
  if (process.env.OPENCODE_PATH) return process.env.OPENCODE_PATH;

  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    const found = execSync(`${whichCmd} opencode`, { encoding: 'utf8', timeout: 5000 })
      .split('\n')[0]
      .trim();
    if (found) return found;
  } catch {
    // not on PATH — fall through to common locations
  }

  for (const candidate of COMMON_OPENCODE_PATHS) {
    if (existsSync(candidate)) return candidate;
  }

  return 'opencode';
}

export interface OpencodeValidationResult {
  /** Whether the binary was found and runnable. */
  installed: boolean;
  /** Parsed version (e.g. "1.17.13"), or null if not found/parseable. */
  version: string | null;
  /** Whether the version satisfies OPENCODE_VERSION_RANGE. */
  compatible: boolean;
  /** Human-readable status / remediation message. */
  message: string;
  /** Where the binary was found. */
  foundAt?: string;
}

/**
 * Check that a compatible `opencode` binary is available. Called at startup
 * only when at least one platform is configured with `agent: opencode`.
 */
export function validateOpencode(): OpencodeValidationResult {
  const opencodePath = getOpencodePath();
  let rawOutput: string;
  try {
    rawOutput = execSync(`"${opencodePath}" --version`, { encoding: 'utf8', timeout: 5000 }).trim();
  } catch (err) {
    return {
      installed: false,
      version: null,
      compatible: false,
      message:
        `opencode binary not found or not runnable (tried "${opencodePath}"). ` +
        `Install it (https://opencode.ai) or set OPENCODE_PATH. Underlying error: ${String(err).split('\n')[0]}`,
      foundAt: opencodePath,
    };
  }

  const parsed = coerce(rawOutput)?.version ?? null;
  if (!parsed) {
    return {
      installed: true,
      version: null,
      compatible: false,
      message: `Could not parse opencode version from "${rawOutput}".`,
      foundAt: opencodePath,
    };
  }

  const compatible = satisfies(parsed, OPENCODE_VERSION_RANGE);
  return {
    installed: true,
    version: parsed,
    compatible,
    message: compatible
      ? `opencode ${parsed} (compatible)`
      : `opencode ${parsed} is outside the supported range ${OPENCODE_VERSION_RANGE}. ` +
        `This bot bundles @opencode-ai/sdk ${BUNDLED_SDK_VERSION}; update opencode to match ` +
        `(e.g. \`npm install -g opencode-ai@${BUNDLED_SDK_VERSION}\` or via your installer).`,
    foundAt: opencodePath,
  };
}
