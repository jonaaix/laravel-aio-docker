<script setup lang="ts">
const { t } = useI18n();
const settingsWindow = useSettingsWindow();
</script>

<template>
    <div class="flex items-center gap-3 rounded-md bg-warning/10 px-3.5 py-2.5 ring ring-warning/25">
        <UIcon name="i-heroicons-exclamation-triangle" class="size-5 shrink-0 text-warning" />
        <div class="min-w-0 flex-1 text-sm">
            <p class="font-semibold text-highlighted">{{ t('Claude is not signed in') }}</p>
            <p class="text-toned">{{ t("Agents can't answer until a Claude subscription is signed in.") }}</p>
        </div>
        <UButton :label="t('Sign in')" color="neutral" variant="outline" class="shrink-0 bg-default" @click="settingsWindow.open('account')" />
    </div>
</template>
