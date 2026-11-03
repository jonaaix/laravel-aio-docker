<script setup lang="ts">
import { toDataURL } from 'qrcode';
import type { PairedDevice } from '#shared/types/device';

const QR_WIDTH_PX = 320;

const { t } = useI18n();
const now = useNow();
const { app, public: { hubUrl } } = useRuntimeConfig();
const devicesVersion = useState('devices-version', () => 0);

const pairing = ref<{ code: string; expiresAt: number } | null>(null);
const qrCode = ref<string | null>(null);
const devices = ref<PairedDevice[]>([]);
const removing = ref<PairedDevice | null>(null);
const removeBusy = ref(false);

const serverUrl = `${window.location.origin}${app.baseURL}`;
const link = computed(() => pairing.value ? `${hubUrl}?${new URLSearchParams({ pair: serverUrl, code: pairing.value.code })}` : '');
const expired = computed(() => pairing.value !== null && pairing.value.expiresAt <= now.value);

async function createLink(): Promise<void> {
    pairing.value = await apiFetch<{ code: string; expiresAt: number }>('devices/pairing-codes', { method: 'POST' });
}

async function loadDevices(): Promise<void> {
    devices.value = await apiFetch<PairedDevice[]>('devices');
}

async function confirmRemove(): Promise<void> {
    if (!removing.value) {
        return;
    }
    removeBusy.value = true;
    try {
        await apiFetch(`devices/${removing.value.id}`, { method: 'DELETE' });
        removing.value = null;
        await loadDevices();
    }
    finally {
        removeBusy.value = false;
    }
}

watch(link, async (value) => {
    qrCode.value = value ? await toDataURL(value, { width: QR_WIDTH_PX, margin: 2, errorCorrectionLevel: 'M' }) : null;
});

watch(devicesVersion, () => Promise.all([loadDevices(), createLink()]));

onMounted(() => Promise.all([createLink(), loadDevices()]));
</script>

<template>
    <div class="flex flex-col gap-6">
        <UFormField :label="t('Pairing link')" :hint="t('Valid once for 10 minutes')">
            <div v-if="!expired" class="flex items-center gap-1">
                <UInput :model-value="link" readonly :aria-label="t('Pairing link')" class="w-full" :ui="{ base: 'font-mono text-xs' }" />
                <ChatCopyButton :text="link" />
            </div>
            <div v-else class="flex items-center gap-3">
                <span class="text-sm text-muted">{{ t('Expired') }}</span>
                <UButton :label="t('New link')" icon="i-heroicons-arrow-path" color="neutral" variant="outline" @click="createLink" />
            </div>
        </UFormField>
        <UFormField v-if="!expired" :label="t('QR code')">
            <div class="size-48 overflow-hidden rounded-xl bg-white ring ring-default">
                <img v-if="qrCode" :src="qrCode" :alt="t('QR code of the pairing link')" class="size-full">
            </div>
        </UFormField>
        <UFormField :label="t('Paired devices')">
            <p v-if="devices.length === 0" class="text-sm text-muted">{{ t('No paired devices') }}</p>
            <ul v-else class="divide-y divide-default rounded-md ring ring-default">
                <li v-for="device in devices" :key="device.id" class="flex items-center gap-3 px-4 py-2">
                    <UIcon name="i-heroicons-device-phone-mobile" class="size-5 shrink-0 text-muted" />
                    <div class="min-w-0 flex-1">
                        <p class="truncate text-sm text-highlighted">{{ device.label }}</p>
                        <p class="text-xs text-muted">{{ t('Last seen {time}', { time: formatRelativeTime(device.lastSeenAt, now) }) }}</p>
                    </div>
                    <UButton :label="t('Remove')" color="neutral" variant="ghost" @click="removing = device" />
                </li>
            </ul>
        </UFormField>
    </div>
    <UModal :open="removing !== null" :title="t('Remove device')" :ui="{ footer: 'justify-end' }" @update:open="open => !open && (removing = null)">
        <template #body>
            <p class="text-sm">{{ t('{name} loses access right away.', { name: removing?.label ?? '' }) }}</p>
        </template>
        <template #footer>
            <UButton :label="t('Cancel')" color="neutral" variant="outline" @click="removing = null" />
            <UButton :label="t('Remove')" color="error" :loading="removeBusy" @click="confirmRemove" />
        </template>
    </UModal>
</template>
