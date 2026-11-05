export interface AccountProfile {
    email: string | null;
    organization: string | null;
    plan: string | null;
}

export interface UsageWindow {
    utilization: number;
    resetsAt: number;
    limited: boolean;
}

export interface UsageSnapshot {
    session: UsageWindow | null;
    week: UsageWindow | null;
    updatedAt: number;
    blockedUntil?: number | null;
}

export interface AccountSummary {
    id: string;
    profile: AccountProfile | null;
    usage: UsageSnapshot | null;
    active: boolean;
}

export interface AccountStatus {
    profile: AccountProfile | null;
    usage: UsageSnapshot | null;
    signedInBy: string | null;
    accounts: AccountSummary[];
}
