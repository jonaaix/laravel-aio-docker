<script setup lang="ts">
import type { SpeechProvider } from '#shared/utils/speech';

const KEY_REJECTED = 422;

const { t } = useI18n();
const { speechRate, setSpeechRate } = useAppearance();

const providers: { value: SpeechProvider; label: string }[] = [
    { value: 'gemini', label: 'Gemini' },
    { value: 'elevenlabs', label: 'ElevenLabs' },
];

const stored = ref<SpeechProvider | null | undefined>(undefined);
const loadFailed = ref(false);
const editing = ref(false);
const provider = ref<SpeechProvider>('gemini');
const apiKey = ref('');
const saving = ref(false);
const error = ref<string>();
const confirmingRemove = ref(false);

const storedLabel = computed(() => providers.find(choice => choice.value === stored.value)?.label ?? '');
const showForm = computed(() => stored.value === null || editing.value);

async function load(): Promise<void> {
    loadFailed.value = false;
    try {
        stored.value = await loadSpeechProvider();
    }
    catch {
        loadFailed.value = true;
    }
}

function startReplacing(): void {
    provider.value = stored.value ?? 'gemini';
    apiKey.value = '';
    error.value = undefined;
    editing.value = true;
}

async function save(): Promise<void> {
    if (!apiKey.value.trim()) {
        error.value = t('Required');
        return;
    }
    saving.value = true;
    error.value = undefined;
    try {
        const result = await apiFetch<{ provider: SpeechProvider }>('speech/service', { method: 'PUT', body: { provider: provider.value, apiKey: apiKey.value } });
        stored.value = result.provider;
        setSpeechProvider(result.provider);
        apiKey.value = '';
        editing.value = false;
    }
    catch (failure) {
        error.value = (failure as { statusCode?: number }).statusCode === KEY_REJECTED
            ? t('The key was not accepted')
            : t('The voice service could not be reached');
    }
    finally {
        saving.value = false;
    }
}

async function remove(): Promise<void> {
    await apiFetch('speech/service', { method: 'DELETE' });
    stored.value = null;
    setSpeechProvider(null);
    confirmingRemove.value = false;
}

onMounted(load);
</script>

<template>
    <div class="flex flex-col gap-6">
        <UFormField :label="t('Reading speed')">
            <div class="flex flex-wrap gap-2">
                <UButton
                    v-for="rate in SPEECH_RATES"
                    :key="rate"
                    :label="formatSpeedFactor(rate)"
                    color="neutral"
                    :variant="speechRate === rate ? 'solid' : 'outline'"
                    class="tabular-nums"
                    @click="setSpeechRate(rate)"
                />
            </div>
        </UFormField>

        <UFormField :label="t('Voice service')" :help="showForm ? t('Without a key, your device\'s voice reads.') : undefined" :error="error">
            <USkeleton v-if="stored === undefined && !loadFailed" class="h-9 w-full sm:w-96" />
            <div v-else-if="loadFailed" class="flex items-center gap-3 text-sm">
                <span class="text-muted">{{ t('Could not load the voice service') }}</span>
                <UButton :label="t('Retry')" color="neutral" variant="outline" @click="load" />
            </div>
            <div v-else-if="!showForm" class="flex flex-wrap items-center gap-3">
                <span class="flex h-9 items-center gap-2 text-sm">
                    <UIcon name="i-heroicons-check-circle" class="size-5 text-success" />
                    {{ t('{service} · key saved', { service: storedLabel }) }}
                </span>
                <UButton :label="t('Replace key')" color="neutral" variant="outline" @click="startReplacing" />
                <UButton :label="t('Remove')" color="neutral" variant="ghost" @click="confirmingRemove = true" />
            </div>
            <form v-else class="flex flex-col gap-3 sm:w-96" @submit.prevent="save">
                <div class="flex flex-wrap gap-2">
                    <UButton
                        v-for="choice in providers"
                        :key="choice.value"
                        :label="choice.label"
                        color="neutral"
                        :variant="provider === choice.value ? 'solid' : 'outline'"
                        @click="provider = choice.value"
                    />
                </div>
                <UInput v-model="apiKey" type="password" autocomplete="off" :placeholder="t('API key')" class="w-full" />
                <div class="flex gap-2">
                    <UButton v-if="editing" :label="t('Cancel')" color="neutral" variant="outline" @click="editing = false" />
                    <UButton type="submit" :label="t('Save key')" :loading="saving" />
                </div>
            </form>
        </UFormField>

        <UModal v-model:open="confirmingRemove" :title="t('Remove key')" :ui="{ footer: 'justify-end' }">
            <template #body>
                <p class="text-sm">{{ t('The key is deleted. Your device\'s voice reads instead.') }}</p>
            </template>
            <template #footer>
                <UButton :label="t('Cancel')" color="neutral" variant="outline" @click="confirmingRemove = false" />
                <UButton :label="t('Remove')" color="error" @click="remove" />
            </template>
        </UModal>
    </div>
</template>
