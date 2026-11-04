<script setup lang="ts">
import type { SpeechProvider } from '#shared/utils/speech';

type VoiceChoice = SpeechProvider | 'device';

interface SpeechServices {
    provider: SpeechProvider | null;
    stored: SpeechProvider[];
}

const KEY_REJECTED = 422;

const { t } = useI18n();
const { speechRate, setSpeechRate } = useAppearance();

const choices: { value: VoiceChoice; label: string }[] = [
    { value: 'device', label: 'Device' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'elevenlabs', label: 'ElevenLabs' },
    { value: 'openai', label: 'OpenAI' },
];

const services = ref<SpeechServices | null>(null);
const loadFailed = ref(false);
const shown = ref<VoiceChoice>('device');
const replacing = ref(false);
const apiKey = ref('');
const saving = ref(false);
const switching = ref(false);
const error = ref<string>();
const confirmingRemove = ref(false);

const active = computed<VoiceChoice>(() => services.value?.provider ?? 'device');
const shownLabel = computed(() => choices.find(choice => choice.value === shown.value)?.label ?? '');
const shownHasKey = computed(() => shown.value !== 'device' && (services.value?.stored.includes(shown.value) ?? false));
const showForm = computed(() => shown.value !== 'device' && (!shownHasKey.value || replacing.value));

function apply(result: SpeechServices): void {
    services.value = result;
    setSpeechProvider(result.provider);
}

async function load(): Promise<void> {
    loadFailed.value = false;
    try {
        apply(await apiFetch<SpeechServices>('speech/service'));
        shown.value = active.value;
    }
    catch {
        loadFailed.value = true;
    }
}

async function choose(choice: VoiceChoice): Promise<void> {
    shown.value = choice;
    replacing.value = false;
    apiKey.value = '';
    error.value = undefined;
    const usable = choice === 'device' || services.value?.stored.includes(choice);
    if (!usable || choice === active.value) {
        return;
    }
    switching.value = true;
    try {
        apply(await apiFetch<SpeechServices>('speech/active', { method: 'PUT', body: { provider: choice === 'device' ? null : choice } }));
    }
    catch {
        error.value = t('Could not switch the voice service');
    }
    finally {
        switching.value = false;
    }
}

async function save(): Promise<void> {
    if (!apiKey.value.trim()) {
        error.value = t('Required');
        return;
    }
    saving.value = true;
    error.value = undefined;
    try {
        apply(await apiFetch<SpeechServices>('speech/service', { method: 'PUT', body: { provider: shown.value, apiKey: apiKey.value } }));
        apiKey.value = '';
        replacing.value = false;
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
    apply(await apiFetch<SpeechServices>('speech/service', { method: 'DELETE', query: { provider: shown.value } }));
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

        <UFormField :label="t('Voice service')" :error="error">
            <USkeleton v-if="services === null && !loadFailed" class="h-9 w-full sm:w-96" />
            <div v-else-if="loadFailed" class="flex items-center gap-3 text-sm">
                <span class="text-muted">{{ t('Could not load the voice service') }}</span>
                <UButton :label="t('Retry')" color="neutral" variant="outline" @click="load" />
            </div>
            <div v-else class="flex flex-col gap-3 sm:w-96">
                <div class="flex flex-wrap gap-2">
                    <UButton
                        v-for="choice in choices"
                        :key="choice.value"
                        :label="t(choice.label)"
                        color="neutral"
                        :variant="shown === choice.value ? 'solid' : 'outline'"
                        :trailing-icon="active === choice.value ? 'i-heroicons-check' : undefined"
                        :loading="switching && shown === choice.value"
                        @click="choose(choice.value)"
                    />
                </div>
                <p v-if="shown === 'device'" class="text-sm text-muted">{{ t('Your device\'s own voice reads aloud.') }}</p>
                <div v-else-if="!showForm" class="flex flex-wrap items-center gap-3">
                    <span class="flex h-9 items-center gap-2 text-sm">
                        <UIcon name="i-heroicons-check-circle" class="size-5 text-success" />
                        {{ t('{service} · key saved', { service: shownLabel }) }}
                    </span>
                    <UButton :label="t('Replace key')" color="neutral" variant="outline" @click="replacing = true" />
                    <UButton :label="t('Remove')" color="neutral" variant="ghost" @click="confirmingRemove = true" />
                </div>
                <form v-else class="flex flex-col gap-3" @submit.prevent="save">
                    <UInput v-model="apiKey" type="password" autocomplete="off" :placeholder="t('{service} API key', { service: shownLabel })" class="w-full" />
                    <div class="flex gap-2">
                        <UButton v-if="replacing" :label="t('Cancel')" color="neutral" variant="outline" @click="replacing = false" />
                        <UButton type="submit" :label="t('Save key')" :loading="saving" />
                    </div>
                </form>
            </div>
        </UFormField>

        <UModal v-model:open="confirmingRemove" :title="t('Remove key')" :ui="{ footer: 'justify-end' }">
            <template #body>
                <p class="text-sm">{{ t('The {service} key is deleted.', { service: shownLabel }) }}</p>
            </template>
            <template #footer>
                <UButton :label="t('Cancel')" color="neutral" variant="outline" @click="confirmingRemove = false" />
                <UButton :label="t('Remove')" color="error" @click="remove" />
            </template>
        </UModal>
    </div>
</template>
