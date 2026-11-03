<script setup lang="ts">
const props = defineProps<{ pairing?: PendingPairing | null; cancellable?: boolean }>();
const emit = defineEmits<{ cancel: [] }>();

const { t } = useI18n();

const link = ref('');
const pending = ref<PendingPairing | null>(props.pairing ?? null);
const busy = ref(false);
const error = ref<string | undefined>();
const scanning = ref(false);

const pendingHost = computed(() => pending.value ? new URL(pending.value.serverUrl).host : '');

watch(() => props.pairing, (value) => {
    pending.value = value ?? null;
});

function review(value: string): void {
    error.value = undefined;
    const pairing = readPairingLink(value);
    if (!pairing) {
        error.value = t('This is not a pairing link');
        return;
    }
    pending.value = pairing;
}

function scanned(value: string): void {
    scanning.value = false;
    review(value);
}

async function connect(): Promise<void> {
    if (!pending.value) {
        return;
    }
    busy.value = true;
    error.value = undefined;
    try {
        const server = await pairServer(pending.value);
        switchServer(server.id);
    }
    catch (failure) {
        const status = (failure as { statusCode?: number }).statusCode;
        error.value = status === 401 ? t('This pairing link is invalid or has expired') : t('Could not reach the chat');
        busy.value = false;
    }
}

function cancel(): void {
    pending.value = null;
    error.value = undefined;
    emit('cancel');
}
</script>

<template>
    <div class="flex w-full flex-col gap-4">
        <template v-if="pending">
            <div class="flex flex-col gap-1">
                <p class="text-base font-semibold text-highlighted">{{ t('Connect to {server}?', { server: pendingHost }) }}</p>
                <p class="text-sm text-muted">{{ pending.serverUrl }}</p>
            </div>
            <UAlert v-if="error" :title="error" icon="i-heroicons-exclamation-triangle" color="error" variant="subtle" />
            <div class="flex justify-end gap-2">
                <UButton :label="t('Cancel')" color="neutral" variant="outline" :disabled="busy" @click="cancel" />
                <UButton :label="t('Connect')" :loading="busy" @click="connect" />
            </div>
        </template>
        <template v-else>
            <UFormField :label="t('Pairing link')" :error="error" :hint="t('Settings → Remote control in your chat')">
                <form class="flex gap-2" @submit.prevent="review(link)">
                    <UInput v-model="link" :placeholder="t('Paste the pairing link')" class="min-w-0 flex-1" autofocus />
                    <UButton type="submit" :label="t('Continue')" :disabled="!link.trim()" />
                </form>
            </UFormField>
            <div class="flex items-center justify-between gap-2">
                <UButton :label="t('Scan QR code')" icon="i-heroicons-qr-code" color="neutral" variant="outline" @click="scanning = true" />
                <UButton v-if="cancellable" :label="t('Cancel')" color="neutral" variant="ghost" @click="cancel" />
            </div>
            <HubQrScanner v-if="scanning" @scanned="scanned" @close="scanning = false" />
        </template>
    </div>
</template>
