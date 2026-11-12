import { createDecipheriv, createHash, createPublicKey, verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Orbit updates itself with a copy of this file (orbit-agent-chat, server/releases/releases.mjs); keep both reading the same release format.

const RELEASES_URL = 'https://github.com/jonaaix/orbit/releases';
const UPDATE_PUBLIC_KEY = 'dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEQ1NTVEODk3QTVDM0U1ODUKUldTRjVjT2xsOWhWMWJnRUlxcUk2bDNXN1RkUjVKVklZOWJYaDRwMWc5S3NiK0RvTFdWMHkvODcK';
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');
const PREHASHED = 'ED';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEPT_RELEASES = 3;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

export function compareVersions(left, right) {
    const a = left.split('.').map(Number);
    const b = right.split('.').map(Number);
    for (let index = 0; index < 3; index++) {
        if (a[index] !== b[index]) {
            return Math.sign(a[index] - b[index]);
        }
    }
    return 0;
}

function releasesDir(dataDir) {
    return join(dataDir, 'releases');
}

export function installedReleases(dataDir) {
    const dir = releasesDir(dataDir);
    if (!existsSync(dir)) {
        return [];
    }
    return readdirSync(dir)
        .filter(version => VERSION_PATTERN.test(version) && existsSync(join(dir, version, 'server/index.mjs')))
        .map(version => ({ version, dir: join(dir, version) }))
        .sort((left, right) => compareVersions(right.version, left.version));
}

export function lastVersion(dataDir) {
    try {
        const version = readFileSync(join(dataDir, 'last-version'), 'utf8').trim();
        return VERSION_PATTERN.test(version) ? version : null;
    }
    catch {
        return null;
    }
}

export function rememberVersion(dataDir, version) {
    writeFileSync(join(dataDir, 'last-version'), version);
}

function releaseKey(dataDir) {
    const path = join(dataDir, 'release-key');
    const encoded = process.env.ORBIT_RELEASE_KEY || (existsSync(path) ? readFileSync(path, 'utf8') : '');
    return encoded.trim() ? Buffer.from(encoded.trim(), 'base64') : null;
}

export function keepReleaseKey(dataDir) {
    const encoded = process.env.ORBIT_RELEASE_KEY?.trim();
    delete process.env.ORBIT_RELEASE_KEY;
    if (encoded) {
        mkdirSync(dataDir, { recursive: true });
        writeFileSync(join(dataDir, 'release-key'), encoded, { mode: 0o600 });
    }
}

export function hasReleaseKey(dataDir) {
    return releaseKey(dataDir) !== null;
}

function minisignLines(base64) {
    return Buffer.from(base64, 'base64').toString('utf8').split('\n');
}

function verifySignature(data, signature) {
    const publicKey = Buffer.from(minisignLines(UPDATE_PUBLIC_KEY)[1], 'base64');
    const signed = Buffer.from(minisignLines(signature)[1] ?? '', 'base64');
    if (!signed.subarray(2, 10).equals(publicKey.subarray(2, 10))) {
        throw new Error('The release was signed with another key');
    }
    const message = signed.subarray(0, 2).toString() === PREHASHED ? createHash('blake2b512').update(data).digest() : data;
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, publicKey.subarray(10)]), format: 'der', type: 'spki' });
    if (!verify(null, message, key, signed.subarray(10))) {
        throw new Error('The release signature does not match');
    }
}

function decrypt(data, key) {
    const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, IV_BYTES));
    decipher.setAuthTag(data.subarray(data.length - TAG_BYTES));
    return Buffer.concat([decipher.update(data.subarray(IV_BYTES, data.length - TAG_BYTES)), decipher.final()]);
}

export async function fetchManifest(version = null) {
    const url = version ? `${RELEASES_URL}/download/v${version}/server.json` : `${RELEASES_URL}/latest/download/server.json`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`${url} answered ${response.status}`);
    }
    const manifest = await response.json();
    if (!VERSION_PATTERN.test(manifest.version) || typeof manifest.url !== 'string' || !manifest.url.startsWith(`${RELEASES_URL}/`)) {
        throw new Error('The release manifest is malformed');
    }
    return manifest;
}

function pruneReleases(dataDir, keep) {
    for (const release of installedReleases(dataDir).slice(KEPT_RELEASES)) {
        if (release.version !== keep) {
            rmSync(release.dir, { recursive: true, force: true });
        }
    }
}

export async function installRelease(dataDir, manifest) {
    const key = releaseKey(dataDir);
    if (!key) {
        throw new Error('No release key is set up: set ORBIT_RELEASE_KEY or place release-key in the data folder');
    }
    const response = await fetch(manifest.url);
    if (!response.ok) {
        throw new Error(`${manifest.url} answered ${response.status}`);
    }
    const data = Buffer.from(await response.arrayBuffer());
    verifySignature(data, manifest.signature);
    const archive = decrypt(data, key);
    const target = join(releasesDir(dataDir), manifest.version);
    const staging = `${target}.partial`;
    rmSync(staging, { recursive: true, force: true });
    mkdirSync(staging, { recursive: true });
    execFileSync('tar', ['-xzf', '-', '-C', staging], { input: archive });
    if (readFileSync(join(staging, 'version'), 'utf8').trim() !== manifest.version) {
        rmSync(staging, { recursive: true, force: true });
        throw new Error(`The release archive does not hold ${manifest.version}`);
    }
    rmSync(target, { recursive: true, force: true });
    renameSync(staging, target);
    pruneReleases(dataDir, manifest.version);
    return { version: manifest.version, dir: target };
}
