<script setup lang="ts">
defineProps<{ pairing: PendingPairing | null }>();
const emit = defineEmits<{ cancel: [] }>();

const { t } = useI18n();
const { app } = useRuntimeConfig();
</script>

<template>
    <main class="flex min-h-dvh items-center justify-center bg-default p-5">
        <div class="flex w-full max-w-md flex-col items-center gap-6">
            <img :src="`${app.baseURL}orbit-icon.svg`" alt="" class="size-20 rounded-[1.25rem] shadow-lg">
            <div class="flex flex-col items-center gap-1 text-center">
                <h1 class="text-xl font-semibold text-highlighted">Orbit</h1>
                <p class="text-sm text-muted">{{ t('Connect a chat to get started.') }}</p>
            </div>
            <div class="w-full rounded-xl p-5 ring ring-default">
                <HubConnectForm :pairing="pairing" :cancellable="hubServers.length > 0" @cancel="emit('cancel')" />
            </div>
        </div>
    </main>
</template>
