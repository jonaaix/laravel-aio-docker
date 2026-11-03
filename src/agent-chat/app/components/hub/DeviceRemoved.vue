<script setup lang="ts">
const emit = defineEmits<{ reconnect: [] }>();

const { t } = useI18n();
const busy = ref(false);

async function remove(): Promise<void> {
    if (!activeServer.value) {
        return;
    }
    busy.value = true;
    await forgetServer(activeServer.value.id);
    await loadHubServers();
    switchServer(activeServerId.value ?? '');
}
</script>

<template>
    <main class="flex min-h-dvh items-center justify-center bg-default p-5">
        <div class="flex max-w-sm flex-col items-center gap-4 text-center">
            <UIcon name="i-heroicons-no-symbol" class="size-8 text-muted" />
            <div class="flex flex-col gap-1">
                <h1 class="text-lg font-semibold text-highlighted">{{ t('This device was removed') }}</h1>
                <p class="text-sm text-muted">{{ t('{server} no longer accepts this device.', { server: activeServer?.label ?? '' }) }}</p>
            </div>
            <div class="flex gap-2">
                <UButton :label="t('Remove server')" color="neutral" variant="outline" :loading="busy" @click="remove" />
                <UButton :label="t('Connect again')" @click="emit('reconnect')" />
            </div>
        </div>
    </main>
</template>
