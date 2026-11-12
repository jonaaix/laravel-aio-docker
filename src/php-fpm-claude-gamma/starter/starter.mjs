import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { compareVersions, fetchManifest, hasReleaseKey, installRelease, installedReleases, keepReleaseKey, lastVersion } from './releases.mjs';

const dataDir = process.env.NUXT_DATA_DIR || join(homedir(), '.config', 'agent-chat');
const bundledVersion = join(import.meta.dirname, 'version');
const bundled = existsSync(bundledVersion) ? [{ version: readFileSync(bundledVersion, 'utf8').trim(), dir: import.meta.dirname }] : [];

async function firstRelease() {
    if (!hasReleaseKey(dataDir)) {
        throw new Error('Orbit is not installed yet and no release key is set up: set ORBIT_RELEASE_KEY or place release-key in the data folder');
    }
    try {
        return await installRelease(dataDir, await fetchManifest());
    }
    catch (error) {
        throw new Error(`Orbit is not installed yet and could not be fetched: ${error.message}`);
    }
}

async function chosenRelease() {
    const newest = [...bundled, ...installedReleases(dataDir)].sort((left, right) => compareVersions(right.version, left.version))[0];
    if (!newest) {
        return firstRelease();
    }
    const last = lastVersion(dataDir);
    if (!last || compareVersions(newest.version, last) >= 0) {
        return newest;
    }
    if (!hasReleaseKey(dataDir)) {
        throw new Error(`Orbit last ran as ${last}, but only ${newest.version} is here and no release key is set up to fetch ${last}`);
    }
    try {
        return await installRelease(dataDir, await fetchManifest(last));
    }
    catch (error) {
        throw new Error(`Orbit last ran as ${last}, but only ${newest.version} is here and ${last} could not be fetched: ${error.message}`);
    }
}

try {
    keepReleaseKey(dataDir);
    const release = await chosenRelease();
    console.log(`[starter] Starting Orbit ${release.version}`);
    const server = spawn(process.execPath, [join(release.dir, 'server/index.mjs')], { stdio: 'inherit', env: { ...process.env, ORBIT_STARTER: '1' } });
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, () => server.kill(signal));
    }
    server.on('exit', code => process.exit(code ?? 1));
}
catch (error) {
    console.error(`[starter] ${error.message}`);
    process.exit(1);
}
