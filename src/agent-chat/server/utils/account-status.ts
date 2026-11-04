import { execFile } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { getClaudePath } from '#claude-threads/claude/version-check';
import type { AccountProfile, AccountStatus, UsageSnapshot, UsageWindow } from '../../shared/types/account';
import type { UserRow } from './user-store';

const DETAILS_HIDDEN_SETTING = 'account.detailsHidden';
const SIGNED_IN_BY_SETTING = 'account.signedInBy';
const HIDDEN_PROFILE: AccountProfile = { email: null, organization: null, plan: null };

interface RateLimitWindow {
    utilization?: number;
    resetsAt?: number;
    status?: string;
}

interface RateLimitInfo {
    unifiedWindows?: Record<string, RateLimitWindow | undefined>;
}

let profile: Promise<AccountProfile | null> | null = null;
let usage: UsageSnapshot | null | undefined;

function usageFile(): string {
    return join(resolveDataDir(), 'usage.json');
}

export async function readProfile(): Promise<AccountProfile | null> {
    try {
        const { stdout } = await promisify(execFile)(getClaudePath(), ['auth', 'status']);
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

function storedUsage(): UsageSnapshot | null {
    if (usage === undefined) {
        usage = existsSync(usageFile()) ? JSON.parse(readFileSync(usageFile(), 'utf8')) as UsageSnapshot : null;
    }
    return usage;
}

function toUsageWindow(limit: RateLimitWindow | undefined): UsageWindow | null {
    if (typeof limit?.utilization !== 'number' || typeof limit.resetsAt !== 'number') {
        return null;
    }
    return { utilization: limit.utilization, resetsAt: limit.resetsAt * 1000, limited: limit.status !== 'allowed' };
}

export function refreshAccountProfile(signedInBy: UserRow | null): void {
    if (signedInBy) {
        writeSetting(SIGNED_IN_BY_SETTING, signedInBy.id);
    }
    else {
        removeSetting(SIGNED_IN_BY_SETTING);
    }
    profile = null;
    usage = null;
    rmSync(usageFile(), { force: true });
    publishConversationListEvent({ type: 'account' });
}

export function accountSignedInBy(): string | null {
    return readSetting(SIGNED_IN_BY_SETTING);
}

export function accountDetailsHidden(): boolean {
    return readSetting(DETAILS_HIDDEN_SETTING) === 'true';
}

export function setAccountDetailsHidden(hidden: boolean): void {
    writeSetting(DETAILS_HIDDEN_SETTING, String(hidden));
    publishConversationListEvent({ type: 'account' });
}

export function detailsHiddenByDefault(user: UserRow): boolean {
    return !user.isAdmin && accountDetailsHidden();
}

export function detailsHiddenFrom(user: UserRow): boolean {
    if (user.id === accountSignedInBy()) {
        return false;
    }
    return user.accountDetails ? user.accountDetails === 'hidden' : detailsHiddenByDefault(user);
}

export function visibleUsage(usageSnapshot: UsageSnapshot | null, user: UserRow): UsageSnapshot | null {
    return usageSnapshot && detailsHiddenFrom(user) ? { ...usageSnapshot, week: null } : usageSnapshot;
}

export async function accountStatusFor(user: UserRow): Promise<AccountStatus> {
    profile ??= readProfile();
    const current = await profile;
    return {
        profile: current && detailsHiddenFrom(user) ? HIDDEN_PROFILE : current,
        usage: visibleUsage(storedUsage(), user),
        detailsHidden: accountDetailsHidden(),
        signedInBy: accountSignedInBy(),
    };
}

export function recordRateLimit(info: unknown): void {
    const windows = (info as RateLimitInfo | undefined)?.unifiedWindows;
    if (!windows) {
        return;
    }
    usage = { session: toUsageWindow(windows.five_hour), week: toUsageWindow(windows.seven_day), updatedAt: Date.now() };
    writeFileSync(usageFile(), JSON.stringify(usage));
    publishConversationListEvent({ type: 'usage', usage });
}
