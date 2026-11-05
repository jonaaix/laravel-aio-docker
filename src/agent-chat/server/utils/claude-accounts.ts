import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AccountProfile, UsageSnapshot } from '../../shared/types/account';

export const MAIN_ACCOUNT_ID = 'main';

const ACCOUNTS_SETTING = 'claude.accounts';
const ACTIVE_SETTING = 'claude.activeAccount';
const OWN_FILES = new Set(['.credentials.json', '.claude.json', '.claude.json.backup']);

export interface ClaudeAccount {
    id: string;
    profile: AccountProfile | null;
    addedBy: string | null;
    usage: UsageSnapshot | null;
}

export interface ClaudeAccountFolder {
    id: string;
    configDir: string | null;
}

export function mainConfigDir(): string {
    return process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
}

function mainGlobalConfig(): string {
    return process.env.CLAUDE_CONFIG_DIR ? join(process.env.CLAUDE_CONFIG_DIR, '.claude.json') : join(homedir(), '.claude.json');
}

export function accountConfigDir(id: string): string | null {
    return id === MAIN_ACCOUNT_ID ? null : join(resolveDataDir(), 'claude-accounts', id);
}

export function credentialsFile(configDir: string | null): string {
    return join(configDir ?? mainConfigDir(), '.credentials.json');
}

export function claudeAccounts(): ClaudeAccount[] {
    const stored = readSetting(ACCOUNTS_SETTING);
    return stored ? JSON.parse(stored) as ClaudeAccount[] : [];
}

function saveAccounts(accounts: ClaudeAccount[]): void {
    writeSetting(ACCOUNTS_SETTING, JSON.stringify(accounts));
}

export function activeAccountId(): string {
    const active = readSetting(ACTIVE_SETTING);
    return active && claudeAccounts().some(account => account.id === active) ? active : MAIN_ACCOUNT_ID;
}

export function activeAccount(): ClaudeAccount | null {
    return claudeAccounts().find(account => account.id === activeAccountId()) ?? null;
}

export function setActiveAccount(id: string): void {
    writeSetting(ACTIVE_SETTING, id);
}

export function upsertAccount(account: ClaudeAccount): void {
    const others = claudeAccounts().filter(existing => existing.id !== account.id);
    saveAccounts([...others, account].sort((a, b) => (a.id === MAIN_ACCOUNT_ID ? -1 : b.id === MAIN_ACCOUNT_ID ? 1 : 0)));
}

export function updateAccount(id: string, change: Partial<ClaudeAccount>): void {
    saveAccounts(claudeAccounts().map(account => account.id === id ? { ...account, ...change } : account));
}

export function forgetAccount(id: string): void {
    saveAccounts(claudeAccounts().filter(account => account.id !== id));
    const folder = accountConfigDir(id);
    if (folder) {
        rmSync(folder, { recursive: true, force: true });
    }
    if (readSetting(ACTIVE_SETTING) === id) {
        removeSetting(ACTIVE_SETTING);
    }
}

export function newAccountId(): string {
    return randomUUID();
}

function linkSharedEntries(folder: string): void {
    const shared = mainConfigDir();
    if (!existsSync(shared)) {
        return;
    }
    for (const entry of readdirSync(shared)) {
        const target = join(folder, entry);
        if (OWN_FILES.has(entry) || existsSync(target) || isSymlink(target)) {
            continue;
        }
        symlinkSync(join(shared, entry), target);
    }
}

function isSymlink(path: string): boolean {
    try {
        return lstatSync(path).isSymbolicLink();
    }
    catch {
        return false;
    }
}

function seedGlobalConfig(folder: string): void {
    const target = join(folder, '.claude.json');
    if (existsSync(target) || !existsSync(mainGlobalConfig())) {
        return;
    }
    copyFileSync(mainGlobalConfig(), target);
    const config = JSON.parse(readFileSync(target, 'utf8')) as Record<string, unknown>;
    delete config.oauthAccount;
    writeFileSync(target, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function prepareAccountFolder(id: string): string | null {
    const folder = accountConfigDir(id);
    if (!folder) {
        return null;
    }
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    linkSharedEntries(folder);
    seedGlobalConfig(folder);
    return folder;
}

export function sessionAccount(): ClaudeAccountFolder {
    const id = activeAccountId();
    return { id, configDir: prepareAccountFolder(id) };
}
