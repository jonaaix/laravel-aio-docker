import type { AccountProfile, AccountStatus, UsageSnapshot } from '#shared/types/account';

export function useAccount() {
    const profile = useState<AccountProfile | null>('account-profile', () => null);
    const usage = useState<UsageSnapshot | null>('account-usage', () => null);

    async function load(): Promise<void> {
        const status = await apiFetch<AccountStatus>('account');
        profile.value = status.profile;
        usage.value = status.usage;
    }

    return { profile, usage, load };
}
