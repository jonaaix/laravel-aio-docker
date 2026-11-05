<script setup lang="ts">
const { t } = useI18n();
const { profile } = useAccount();
const settingsWindow = useSettingsWindow();
</script>

<template>
    <div v-if="profile" class="w-full rounded-md bg-default p-3 ring ring-default dark:bg-default/60">
        <p class="truncate text-sm font-medium text-highlighted">{{ profile.email ?? t('Claude account') }}</p>
        <UsageMeters class="mt-2.5" />
    </div>
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
