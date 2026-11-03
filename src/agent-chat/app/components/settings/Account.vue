<script setup lang="ts">
import type { AccountStatus } from '#shared/types/account';

type Step = 'idle' | 'starting' | 'code' | 'verifying';

const { profile } = useAccount();

const step = ref<Step>('idle');
const signInUrl = ref('');
const code = ref('');
const error = ref<string | undefined>();
const signingOut = ref(false);

const details = computed(() => {
    const plan = profile.value?.plan ? profile.value.plan.charAt(0).toUpperCase() + profile.value.plan.slice(1) : null;
    return [profile.value?.organization, plan].filter(Boolean).join(' · ');
});

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
        error.value = failureMessage(failure, 'Could not start the sign-in');
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
        profile.value = (await apiFetch<AccountStatus>('account/code', { method: 'POST', body: { code: code.value } })).profile;
        code.value = '';
        step.value = 'idle';
    }
    catch (failure) {
        error.value = failureMessage(failure, 'The code was not accepted');
        code.value = '';
        step.value = 'idle';
    }
}

async function cancelSignIn(): Promise<void> {
    step.value = 'idle';
    code.value = '';
    await apiFetch('account/login', { method: 'DELETE' });
}

async function signOut(): Promise<void> {
    signingOut.value = true;
    error.value = undefined;
    try {
        profile.value = (await apiFetch<AccountStatus>('account/logout', { method: 'POST' })).profile;
    }
    catch (failure) {
        error.value = failureMessage(failure, 'Could not sign out');
    }
    finally {
        signingOut.value = false;
    }
}

onBeforeUnmount(() => {
    if (step.value === 'code') {
        void cancelSignIn();
    }
});
</script>

<template>
    <div class="flex max-w-xl flex-col gap-4">
        <template v-if="profile && (step === 'idle' || step === 'starting')">
            <div class="rounded-md p-4 ring ring-default">
                <p class="truncate font-medium text-highlighted">{{ profile.email }}</p>
                <p v-if="details" class="truncate text-sm text-muted">{{ details }}</p>
                <UsageMeters class="mt-3" />
            </div>
            <div class="flex flex-wrap gap-2">
                <UButton label="Switch account" icon="i-heroicons-arrows-right-left" color="neutral" variant="outline" :loading="step === 'starting'" @click="startSignIn" />
                <UButton label="Sign out" icon="i-heroicons-arrow-right-on-rectangle" color="neutral" variant="ghost" :loading="signingOut" @click="signOut" />
            </div>
        </template>

        <template v-else-if="step === 'code' || step === 'verifying'">
            <p class="text-sm text-toned">Sign in on Claude's page, approve access, then paste the code it shows.</p>
            <div>
                <UButton label="Open sign-in page" icon="i-heroicons-arrow-top-right-on-square" color="neutral" variant="outline" :to="signInUrl" target="_blank" />
            </div>
            <form class="flex flex-col gap-3" @submit.prevent="submitCode">
                <UFormField label="Code">
                    <UInput v-model="code" autocomplete="off" class="w-full" :disabled="step === 'verifying'" />
                </UFormField>
                <div class="flex gap-2">
                    <UButton type="submit" label="Continue" :loading="step === 'verifying'" :disabled="!code.trim()" />
                    <UButton label="Cancel" color="neutral" variant="ghost" :disabled="step === 'verifying'" @click="cancelSignIn" />
                </div>
            </form>
        </template>

        <template v-else-if="!profile">
            <div class="flex items-start gap-3 rounded-md bg-elevated/60 p-4">
                <UIcon name="i-heroicons-key" class="mt-0.5 size-5 shrink-0 text-muted" />
                <div>
                    <p class="font-medium text-highlighted">Not signed in</p>
                    <p class="text-sm text-toned">Agents answer once Claude is signed in to a Claude subscription.</p>
                </div>
            </div>
            <div>
                <UButton label="Sign in with Claude" :loading="step === 'starting'" @click="startSignIn" />
            </div>
        </template>

        <p v-if="error" class="text-sm text-error">{{ error }}</p>
    </div>
</template>
