<script setup lang="ts">
import type { AccountStatus, AccountSummary } from '#shared/types/account';

type Step = 'idle' | 'starting' | 'code' | 'verifying';

const { t } = useI18n();
const { accounts, apply, switchTo } = useAccount();

const step = ref<Step>('idle');
const signInUrl = ref('');
const code = ref('');
const error = ref<string | undefined>();
const busyId = ref<string | null>(null);
const removing = ref<AccountSummary | null>(null);

function details(account: AccountSummary): string {
    const plan = account.profile?.plan ? account.profile.plan.charAt(0).toUpperCase() + account.profile.plan.slice(1) : null;
    return [account.profile?.organization, plan].filter(Boolean).join(' · ');
}

function failureMessage(failure: unknown, fallback: string): string {
    const data = failure as { data?: { statusMessage?: string }; statusMessage?: string };
    return data.data?.statusMessage ?? data.statusMessage ?? fallback;
}

async function startSignIn(): Promise<void> {
    step.value = 'starting';
    error.value = undefined;
    try {
        signInUrl.value = (await apiFetch<{ url: string }>('account/login', { method: 'POST' })).url;
        step.value = 'code';
    }
    catch (failure) {
        error.value = failureMessage(failure, t('Could not start the sign-in'));
        step.value = 'idle';
    }
}

async function submitCode(): Promise<void> {
    if (!code.value.trim() || step.value !== 'code') {
        return;
    }
    step.value = 'verifying';
    error.value = undefined;
    try {
        apply(await apiFetch<AccountStatus>('account/code', { method: 'POST', body: { code: code.value } }));
    }
    catch (failure) {
        error.value = failureMessage(failure, t('The code was not accepted'));
    }
    finally {
        code.value = '';
        step.value = 'idle';
    }
}

async function cancelSignIn(): Promise<void> {
    step.value = 'idle';
    code.value = '';
    await apiFetch('account/login', { method: 'DELETE' });
}

async function switchAccount(account: AccountSummary): Promise<void> {
    busyId.value = account.id;
    error.value = undefined;
    try {
        await switchTo(account.id);
    }
    catch (failure) {
        error.value = failureMessage(failure, t('Could not switch the account'));
    }
    finally {
        busyId.value = null;
    }
}

async function removeAccount(): Promise<void> {
    const account = removing.value;
    removing.value = null;
    if (!account) {
        return;
    }
    busyId.value = account.id;
    error.value = undefined;
    try {
        apply(await apiFetch<AccountStatus>('account/logout', { method: 'POST', body: { id: account.id } }));
    }
    catch (failure) {
        error.value = failureMessage(failure, t('Could not sign out'));
    }
    finally {
        busyId.value = null;
    }
}

onBeforeUnmount(() => {
    if (step.value === 'code') {
        void cancelSignIn();
    }
});
</script>

<template>
    <div class="flex max-w-3xl flex-col gap-4">
        <template v-if="step === 'code' || step === 'verifying'">
            <p class="text-sm text-toned">{{ t('Sign in on Claude\'s page, approve access, then paste the code it shows.') }}</p>
            <div>
                <UButton :label="t('Open sign-in page')" icon="i-heroicons-arrow-top-right-on-square" color="neutral" variant="outline" :to="signInUrl" target="_blank" />
            </div>
            <form class="flex max-w-xl flex-col gap-3" @submit.prevent="submitCode">
                <UFormField :label="t('Code')">
                    <UInput v-model="code" autocomplete="off" class="w-full" :disabled="step === 'verifying'" />
                </UFormField>
                <div class="flex gap-2">
                    <UButton type="submit" :label="t('Continue')" :loading="step === 'verifying'" :disabled="!code.trim()" />
                    <UButton :label="t('Cancel')" color="neutral" variant="ghost" :disabled="step === 'verifying'" @click="cancelSignIn" />
                </div>
            </form>
        </template>

        <template v-else-if="accounts.length > 0">
            <div class="grid gap-3 sm:grid-cols-2">
                <div
                    v-for="account in accounts"
                    :key="account.id"
                    class="flex flex-col gap-3 rounded-md p-4 ring"
                    :class="account.active ? 'bg-primary/5 ring-primary/40' : 'ring-default'"
                >
                    <div class="flex items-start gap-2">
                        <div class="min-w-0 flex-1">
                            <p class="truncate font-medium text-highlighted">{{ account.profile?.email ?? t('Claude account') }}</p>
                            <p v-if="details(account)" class="truncate text-sm text-muted">{{ details(account) }}</p>
                        </div>
                        <UBadge v-if="account.active" :label="t('In use')" color="primary" variant="subtle" />
                    </div>
                    <UsageMeters :usage="account.usage" />
                    <p v-if="!account.usage" class="text-xs text-muted">{{ t('No usage known yet') }}</p>
                    <div class="mt-auto flex flex-wrap gap-2">
                        <UButton
                            v-if="!account.active"
                            :label="t('Switch to this account')"
                            icon="i-heroicons-arrows-right-left"
                            color="neutral"
                            variant="outline"
                            :loading="busyId === account.id"
                            @click="switchAccount(account)"
                        />
                        <UButton :label="t('Remove')" color="neutral" variant="ghost" :disabled="busyId === account.id" @click="removing = account" />
                    </div>
                </div>
            </div>
            <div>
                <UButton :label="t('Add account')" icon="i-heroicons-plus" color="neutral" variant="outline" :loading="step === 'starting'" @click="startSignIn" />
            </div>
        </template>

        <template v-else>
            <div class="flex items-start gap-3 rounded-md bg-elevated/60 p-4">
                <UIcon name="i-heroicons-key" class="mt-0.5 size-5 shrink-0 text-muted" />
                <div>
                    <p class="font-medium text-highlighted">{{ t('Not signed in') }}</p>
                    <p class="text-sm text-toned">{{ t('Agents answer once Claude is signed in to a Claude subscription.') }}</p>
                </div>
            </div>
            <div>
                <UButton :label="t('Sign in with Claude')" :loading="step === 'starting'" @click="startSignIn" />
            </div>
        </template>

        <p v-if="error" class="text-sm text-error">{{ error }}</p>

        <UModal :open="removing !== null" :title="t('Remove account')" :ui="{ footer: 'justify-end' }" @update:open="open => { if (!open) removing = null }">
            <template #body>
                <p class="text-sm">{{ t('{account} is signed out of the chat.', { account: removing?.profile?.email ?? t('Claude account') }) }}</p>
            </template>
            <template #footer>
                <UButton :label="t('Cancel')" color="neutral" variant="outline" @click="removing = null" />
                <UButton :label="t('Remove')" color="error" @click="removeAccount" />
            </template>
        </UModal>
    </div>
</template>
