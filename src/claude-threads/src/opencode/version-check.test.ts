/**
 * Tests for opencode version-check pure logic: the compatibility range and the
 * OPENCODE_PATH override. (validateOpencode() itself shells out to the binary,
 * so it's exercised at runtime / in the manual E2E rather than here.)
 */

import { describe, it, expect, afterEach } from 'bun:test';
import { satisfies, coerce } from 'semver';
import { OPENCODE_VERSION_RANGE, getOpencodePath } from './version-check.js';

describe('OPENCODE_VERSION_RANGE', () => {
  it('accepts the bundled SDK version line (1.18.x) and cross-minor 1.17.x', () => {
    expect(satisfies(coerce('1.18.3')!.version, OPENCODE_VERSION_RANGE)).toBe(true); // bundled
    expect(satisfies(coerce('1.17.13')!.version, OPENCODE_VERSION_RANGE)).toBe(true); // cross-minor
    expect(satisfies(coerce('1.17.0')!.version, OPENCODE_VERSION_RANGE)).toBe(true);
  });

  it('rejects versions below the floor (e.g. the old 1.1.x line)', () => {
    expect(satisfies(coerce('1.1.20')!.version, OPENCODE_VERSION_RANGE)).toBe(false);
  });

  it('rejects a future breaking major (2.x)', () => {
    expect(satisfies(coerce('2.0.0')!.version, OPENCODE_VERSION_RANGE)).toBe(false);
  });
});

describe('getOpencodePath', () => {
  const original = process.env.OPENCODE_PATH;
  afterEach(() => {
    if (original === undefined) delete process.env.OPENCODE_PATH;
    else process.env.OPENCODE_PATH = original;
  });

  it('honors the OPENCODE_PATH override verbatim', () => {
    process.env.OPENCODE_PATH = '/custom/bin/opencode';
    expect(getOpencodePath()).toBe('/custom/bin/opencode');
  });
});
