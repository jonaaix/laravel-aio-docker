import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { getClaudePath } from '#claude-threads/claude/version-check';
import type { AccountProfile, AccountStatus, UsageSnapshot, UsageWindow } from '../../shared/types/account';

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

async function readProfile(): Promise<AccountProfile | null> {
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

export async function getAccountStatus(): Promise<AccountStatus> {
    profile ??= readProfile();
    return { profile: await profile, usage: storedUsage() };
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
