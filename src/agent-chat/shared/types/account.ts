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
}

export interface AccountStatus {
    profile: AccountProfile | null;
    usage: UsageSnapshot | null;
    detailsHidden: boolean;
    signedInBy: string | null;
}
