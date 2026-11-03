<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
    <main class="flex min-h-dvh items-center justify-center bg-default p-5">
        <div class="flex max-w-sm flex-col items-center gap-3 text-center">
            <UIcon name="i-heroicons-lock-closed" class="size-8 text-muted" />
            <h1 class="text-lg font-semibold text-highlighted">{{ t('Unauthorized') }}</h1>
            <p class="text-sm text-muted">{{ t('Open the chat from the app you are signed in to.') }}</p>
        </div>
    </main>
</template>
