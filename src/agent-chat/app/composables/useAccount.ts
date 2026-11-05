import type { AccountProfile, AccountStatus, AccountSummary, UsageSnapshot } from '#shared/types/account';

export function useAccount() {
    const profile = useState<AccountProfile | null>('account-profile', () => null);
    const usage = useState<UsageSnapshot | null>('account-usage', () => null);
    const loaded = useState<boolean>('account-loaded', () => false);
    const signedInBy = useState<string | null>('account-signed-in-by', () => null);
    const accounts = useState<AccountSummary[]>('account-list', () => []);

    function apply(status: AccountStatus): void {
        profile.value = status.profile;
        usage.value = status.usage;
        signedInBy.value = status.signedInBy;
        accounts.value = status.accounts;
        loaded.value = true;
    }

    async function load(): Promise<void> {
        apply(await apiFetch<AccountStatus>('account'));
    }

    async function switchTo(id: string): Promise<void> {
        apply(await apiFetch<AccountStatus>('account/switch', { method: 'POST', body: { id } }));
    }

    return { profile, usage, loaded, signedInBy, accounts, apply, load, switchTo };
}
