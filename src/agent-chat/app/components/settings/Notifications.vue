<script setup lang="ts">
const { t, locale } = useI18n();

const support = pushSupport();
const enabled = ref(false);
const loading = ref(true);
const busy = ref(false);
const error = ref<string | undefined>();

async function toggle(value: boolean): Promise<void> {
    if (!activeServer.value) {
        return;
    }
    busy.value = true;
    error.value = undefined;
    try {
        if (value) {
            await enableServerPush(activeServer.value, locale.value);
        }
        else {
            await disableServerPush();
        }
        enabled.value = value;
    }
    catch (failure) {
        error.value = (failure as Error).message === 'denied' ? t('Notifications are blocked in the browser settings') : t('Could not change notifications');
    }
    finally {
        busy.value = false;
    }
}

onMounted(async () => {
    try {
        enabled.value = support === 'ready' && await serverPushEnabled();
    }
    finally {
        loading.value = false;
    }
});
</script>

<template>
    <div class="flex flex-col gap-4">
        <UAlert v-if="support === 'install'" :title="t('Add Orbit to your home screen')" :description="t('Notifications work only in the installed app.')" icon="i-heroicons-information-circle" color="neutral" variant="subtle" />
        <UAlert v-else-if="support === 'unsupported'" :title="t('This browser cannot show notifications')" icon="i-heroicons-information-circle" color="neutral" variant="subtle" />
        <UFormField v-else :label="t('Notifications')" :error="error">
            <USwitch
                :model-value="enabled"
                :label="t('Notify me on this device when {server} finishes an answer', { server: activeServer?.label ?? '' })"
                :loading="loading || busy"
                :disabled="loading || busy"
                @update:model-value="value => toggle(value === true)"
            />
        </UFormField>
    </div>
</template>
