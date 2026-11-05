<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { AccountSummary, UsageWindow } from '#shared/types/account';

const { t } = useI18n();
const { profile, accounts, switchTo } = useAccount();
const settingsWindow = useSettingsWindow();

function usageLine(account: AccountSummary): string | undefined {
    const parts = [['Session', account.usage?.session], ['Week', account.usage?.week]]
        .filter((entry): entry is [string, UsageWindow] => Boolean(entry[1]))
        .map(([label, limit]) => `${t(label)} ${formatPercent(limit.utilization)}`);
    return parts.length > 0 ? parts.join(' · ') : undefined;
}

const menu = computed<DropdownMenuItem[][]>(() => [
    accounts.value.map(account => ({
        label: account.profile?.email ?? t('Claude account'),
        description: usageLine(account),
        type: 'checkbox' as const,
        checked: account.active,
        onSelect: () => {
            if (!account.active) {
                void switchTo(account.id);
            }
        },
    })),
    [{ label: t('Manage accounts'), icon: 'i-heroicons-cog-6-tooth', onSelect: () => settingsWindow.open('account') }],
]);
</script>

<template>
    <UDropdownMenu v-if="profile" :items="menu" :content="{ side: 'top', align: 'start' }" :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-64', itemLabel: 'font-medium', itemDescription: 'text-xs tabular-nums' }">
        <button type="button" class="w-full rounded-md bg-default p-3 text-start ring ring-default transition-colors duration-500 ease-out hover:bg-primary/10 dark:bg-default/60 dark:hover:bg-primary/10">
            <span class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ profile.email ?? t('Claude account') }}</span>
                <UIcon v-if="accounts.length > 1" name="i-heroicons-chevron-up-down" class="size-4 shrink-0 text-muted" />
            </span>
            <UsageMeters class="mt-2.5" />
        </button>
    </UDropdownMenu>
    <button
        v-else
        type="button"
        class="flex w-full items-center gap-2 rounded-md bg-default p-3 text-start ring ring-default transition-colors duration-500 ease-out hover:bg-primary/10 dark:bg-default/60 dark:hover:bg-primary/10"
        @click="settingsWindow.open('account')"
    >
        <UIcon name="i-heroicons-key" class="size-4 shrink-0 text-muted" />
        <span class="text-sm font-medium text-highlighted">{{ t('Not signed in') }}</span>
    </button>
</template>
