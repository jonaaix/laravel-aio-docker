<script setup lang="ts">
import { toDataURL } from 'qrcode';

const QR_WIDTH_PX = 320;

const { t } = useI18n();

const { user } = useUserName();

const link = computed(() => user.value ? `${window.location.origin}${useRuntimeConfig().app.baseURL}#mobile-connect=${user.value.id}` : '');
const code = ref<string | null>(null);

watch(link, async (value) => {
    code.value = value ? await toDataURL(value, { width: QR_WIDTH_PX, margin: 2, errorCorrectionLevel: 'M' }) : null;
}, { immediate: true });
</script>

<template>
    <div class="flex flex-col gap-4">
        <UFormField v-if="user" :label="t('Mobile app link')">
            <div class="flex items-center gap-1">
                <UInput :model-value="link" readonly :aria-label="t('Mobile app link')" class="w-full" :ui="{ base: 'font-mono text-xs' }" />
                <ChatCopyButton :text="link" />
            </div>
        </UFormField>
        <UFormField v-if="user" :label="t('QR code')">
            <div class="size-48 overflow-hidden rounded-xl bg-white ring ring-default">
                <img v-if="code" :src="code" :alt="t('QR code of the mobile app link')" class="size-full">
            </div>
        </UFormField>
    </div>
</template>
