import type { AccountProfile, AccountStatus, UsageSnapshot } from '#shared/types/account';

export function useAccount() {
    const profile = useState<AccountProfile | null>('account-profile', () => null);
    const usage = useState<UsageSnapshot | null>('account-usage', () => null);
    const loaded = useState<boolean>('account-loaded', () => false);
    const detailsHidden = useState<boolean>('account-details-hidden', () => false);

    async function load(): Promise<void> {
        const status = await apiFetch<AccountStatus>('account');
        profile.value = status.profile;
        usage.value = status.usage;
        detailsHidden.value = status.detailsHidden;
        loaded.value = true;
    }

    return { profile, usage, loaded, detailsHidden, load };
}
