import { execFile } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { getClaudePath } from '#claude-threads/claude/version-check';
import type { AccountProfile, AccountStatus, AccountSummary, UsageSnapshot, UsageWindow } from '../../shared/types/account';
import type { ClaudeAccount } from './claude-accounts';
import type { UserRow } from './user-store';

const LEGACY_SIGNED_IN_BY_SETTING = 'account.signedInBy';
const HIDDEN_PROFILE: AccountProfile = { email: null, organization: null, plan: null };
const LIMIT_REACHED = 'rejected';

interface RateLimitWindow {
    utilization?: number;
    resetsAt?: number;
    status?: string;
}

interface RateLimitInfo {
    unifiedWindows?: Record<string, RateLimitWindow | undefined>;
}

let mainChecked: Promise<void> | null = null;

function legacyUsageFile(): string {
    return join(resolveDataDir(), 'usage.json');
}

function claudeEnv(configDir: string | null): NodeJS.ProcessEnv {
    return configDir ? { ...process.env, CLAUDE_CONFIG_DIR: configDir } : process.env;
}

export async function readProfile(configDir: string | null = null): Promise<AccountProfile | null> {
    try {
        const { stdout } = await promisify(execFile)(getClaudePath(), ['auth', 'status'], { env: claudeEnv(configDir) });
        const status = JSON.parse(stdout) as { loggedIn?: boolean; email?: string; orgName?: string; subscriptionType?: string };
        if (!status.loggedIn || !status.email) {
            return null;
        }
        return { email: status.email, organization: status.orgName ?? null, plan: status.subscriptionType ?? null };
    }
    catch {
        return null;
    }
}

async function adoptMainAccount(): Promise<void> {
    if (claudeAccounts().some(account => account.id === MAIN_ACCOUNT_ID)) {
        return;
    }
    const profile = await readProfile(null);
    if (!profile) {
        return;
    }
    const usage = existsSync(legacyUsageFile()) ? JSON.parse(readFileSync(legacyUsageFile(), 'utf8')) as UsageSnapshot : null;
    upsertAccount({ id: MAIN_ACCOUNT_ID, profile, addedBy: readSetting(LEGACY_SIGNED_IN_BY_SETTING), usage });
    removeSetting(LEGACY_SIGNED_IN_BY_SETTING);
    rmSync(legacyUsageFile(), { force: true });
}

export function ensureMainAccount(): Promise<void> {
    mainChecked ??= adoptMainAccount();
    return mainChecked;
}

function toUsageWindow(limit: RateLimitWindow | undefined): UsageWindow | null {
    if (typeof limit?.utilization !== 'number' || typeof limit.resetsAt !== 'number') {
        return null;
    }
    return { utilization: limit.utilization, resetsAt: limit.resetsAt * 1000, limited: limit.status === LIMIT_REACHED };
}

export function accountSignedInBy(): string | null {
    return activeAccount()?.addedBy ?? null;
}

function hiddenFrom(user: UserRow, account: ClaudeAccount | null): boolean {
    return user.accountDetails === 'hidden' && user.id !== account?.addedBy;
}

export function detailsHiddenFrom(user: UserRow): boolean {
    return hiddenFrom(user, activeAccount());
}

export function visibleUsage(usageSnapshot: UsageSnapshot | null, user: UserRow, account: ClaudeAccount | null = activeAccount()): UsageSnapshot | null {
    return usageSnapshot && hiddenFrom(user, account) ? { ...usageSnapshot, week: null } : usageSnapshot;
}

function summaryFor(account: ClaudeAccount, user: UserRow, activeId: string): AccountSummary {
    return {
        id: account.id,
        profile: account.profile && hiddenFrom(user, account) ? HIDDEN_PROFILE : account.profile,
        usage: visibleUsage(account.usage, user, account),
        active: account.id === activeId,
    };
}

export async function accountStatusFor(user: UserRow): Promise<AccountStatus> {
    await ensureMainAccount();
    const activeId = activeAccountId();
    const accounts = claudeAccounts().map(account => summaryFor(account, user, activeId));
    const active = accounts.find(account => account.active) ?? null;
    return {
        profile: active?.profile ?? null,
        usage: active?.usage ?? null,
        signedInBy: accountSignedInBy(),
        accounts,
    };
}

export function recordRateLimit(info: unknown, accountId: string): void {
    const windows = (info as RateLimitInfo | undefined)?.unifiedWindows;
    if (!windows) {
        return;
    }
    const usage: UsageSnapshot = { session: toUsageWindow(windows.five_hour), week: toUsageWindow(windows.seven_day), updatedAt: Date.now() };
    updateAccount(accountId, { usage });
    if (accountId === activeAccountId()) {
        publishConversationListEvent({ type: 'usage', usage });
    }
}

export async function rememberSignedInAccount(id: string, signedInBy: UserRow): Promise<void> {
    const profile = await readProfile(accountConfigDir(id));
    if (!profile) {
        throw new Error('Claude did not confirm the sign-in.');
    }
    for (const duplicate of claudeAccounts().filter(account => account.id !== id && account.profile?.email === profile.email)) {
        forgetAccount(duplicate.id);
    }
    const previous = claudeAccounts().find(account => account.id === id);
    upsertAccount({ id, profile, addedBy: signedInBy.id, usage: previous?.usage ?? null });
    switchClaudeAccount(id);
}

export function switchClaudeAccount(id: string): void {
    setActiveAccount(id);
    settleClaudeAccountSwitch();
    publishConversationListEvent({ type: 'account' });
}

export async function signOutClaudeAccount(id: string): Promise<void> {
    await promisify(execFile)(getClaudePath(), ['auth', 'logout'], { env: claudeEnv(accountConfigDir(id)) });
    const wasActive = id === activeAccountId();
    forgetAccount(id);
    if (wasActive) {
        const next = claudeAccounts()[0];
        switchClaudeAccount(next?.id ?? MAIN_ACCOUNT_ID);
        return;
    }
    publishConversationListEvent({ type: 'account' });
}
