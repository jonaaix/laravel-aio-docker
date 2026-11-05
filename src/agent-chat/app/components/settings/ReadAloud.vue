<script setup lang="ts">
import type { OptionStripItem } from '~/components/OptionStrip.vue';
import { SPEECH_MODELS, SPEECH_VOICES, type SpeechProvider } from '#shared/utils/speech';

type VoiceChoice = SpeechProvider | 'device';

interface SpeechServices {
    provider: SpeechProvider | null;
    stored: SpeechProvider[];
    models: Record<SpeechProvider, string>;
}

const NO_CREDIT = 402;

type KeyProblem = 'key' | 'credit' | 'unavailable';

const PROBLEM_TEXTS: Record<KeyProblem, string> = {
    key: 'Key saved, but {service} did not accept it. Check it and save it again.',
    credit: '{service} has no credit left on this account. Add credit there, then choose {service} again.',
    unavailable: 'Key saved, but {service} could not be reached. Choose {service} again later.',
};

const { t, locale } = useI18n();
const { speechRate, speechVoiceFor, setSpeechVoice } = useAppearance();

const choices: { value: VoiceChoice; label: string }[] = [
    { value: 'google', label: 'Google Cloud' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'elevenlabs', label: 'ElevenLabs' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'device', label: 'Device' },
];

const services = ref<SpeechServices | null>(null);
const loadFailed = ref(false);
const shown = ref<VoiceChoice>('device');
const replacing = ref(false);
const apiKey = ref('');
const saving = ref(false);
const switching = ref(false);
const error = ref<string>();
const problem = ref<{ provider: SpeechProvider; reason: KeyProblem } | null>(null);
const confirmingRemove = ref(false);
const playing = ref<string | null>(null);
const loadingSample = ref<string | null>(null);
const soundsLike = ref<Record<string, string> | null>(null);
const loadingVoices = ref(false);
let sampleAudio: HTMLAudioElement | undefined;

const active = computed<VoiceChoice>(() => services.value?.provider ?? 'device');
const serviceOptions = computed<OptionStripItem<VoiceChoice>[]>(() => choices.map(choice => ({
    value: choice.value,
    label: t(choice.label),
    icon: active.value === choice.value ? (switching.value ? 'i-heroicons-arrow-path' : 'i-heroicons-check-circle') : undefined,
})));
const shownLabel = computed(() => choices.find(choice => choice.value === shown.value)?.label ?? '');
const shownHasKey = computed(() => shown.value !== 'device' && (services.value?.stored.includes(shown.value) ?? false));
const showForm = computed(() => shown.value !== 'device' && (!shownHasKey.value || replacing.value));
const distinctVoices = computed(() => shown.value === 'device' ? [] : SPEECH_VOICES[shown.value].filter(voice => !soundsLike.value || soundsLike.value[voice.id] === voice.id));
const chosenVoice = computed(() => {
    if (shown.value === 'device') {
        return null;
    }
    const voice = speechVoiceFor(shown.value);
    return soundsLike.value?.[voice] ?? voice;
});

async function loadVoices(): Promise<void> {
    const provider = shown.value;
    soundsLike.value = null;
    if (provider === 'device' || !shownHasKey.value) {
        return;
    }
    loadingVoices.value = true;
    try {
        const result = await apiFetch<{ soundsLike: Record<string, string> }>('speech/voices', { query: { provider, language: locale.value } });
        if (shown.value === provider) {
            soundsLike.value = result.soundsLike;
        }
    }
    catch {
        soundsLike.value = null;
    }
    finally {
        loadingVoices.value = false;
    }
}

watch(() => [shown.value, shownHasKey.value, shown.value === 'device' ? null : services.value?.models[shown.value], locale.value], loadVoices);

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
        const provider = shown.value as SpeechProvider;
        const result = await apiFetch<SpeechServices & { problem?: KeyProblem }>('speech/service', { method: 'PUT', body: { provider, apiKey: apiKey.value } });
        apply(result);
        problem.value = result.problem ? { provider, reason: result.problem } : null;
        apiKey.value = '';
        replacing.value = false;
    }
    catch {
        error.value = t('The key could not be saved');
    }
    finally {
        saving.value = false;
    }
}

async function chooseModel(provider: SpeechProvider, model: string): Promise<void> {
    error.value = undefined;
    try {
        apply(await apiFetch<SpeechServices>('speech/model', { method: 'PUT', body: { provider, model } }));
    }
    catch {
        error.value = t('Could not change the quality');
    }
}

function stopSample(): void {
    sampleAudio?.pause();
    sampleAudio = undefined;
    playing.value = null;
}

async function playSample(provider: SpeechProvider, voice: string): Promise<void> {
    const wasPlaying = playing.value === voice;
    stopSample();
    if (wasPlaying) {
        return;
    }
    loadingSample.value = voice;
    error.value = undefined;
    try {
        const blob = await apiFetch<Blob>('speech/preview', { method: 'POST', body: { provider, voice, text: t('This is how I sound when I read answers to you.'), language: locale.value }, responseType: 'blob' });
        const audio = new Audio(URL.createObjectURL(blob));
        audio.playbackRate = speechRate.value;
        audio.addEventListener('ended', stopSample);
        sampleAudio = audio;
        playing.value = voice;
        await audio.play();
    }
    catch (failure) {
        if ((failure as { statusCode?: number }).statusCode === NO_CREDIT) {
            problem.value = { provider, reason: 'credit' };
        }
        else {
            error.value = t('The voice service could not be reached');
        }
        stopSample();
    }
    finally {
        loadingSample.value = null;
    }
}

onBeforeUnmount(stopSample);

async function remove(): Promise<void> {
    apply(await apiFetch<SpeechServices>('speech/service', { method: 'DELETE', query: { provider: shown.value } }));
    confirmingRemove.value = false;
}

onMounted(load);
</script>

<template>
    <div class="flex flex-col gap-6">
        <UFormField :label="t('Reading speed')">
            <SpeechRateSlider :label="t('Reading speed')" class="max-w-3xl" />
        </UFormField>

        <UFormField :label="t('Voice service')" :error="error">
            <USkeleton v-if="services === null && !loadFailed" class="h-9 w-full max-w-3xl" />
            <div v-else-if="loadFailed" class="flex items-center gap-3 text-sm">
                <span class="text-muted">{{ t('Could not load the voice service') }}</span>
                <UButton :label="t('Retry')" color="neutral" variant="outline" @click="load" />
            </div>
            <div v-else class="flex max-w-3xl flex-col gap-4">
                <OptionStrip
                    :model-value="shown"
                    :items="serviceOptions"
                    :label="t('Voice service')"
                    class="self-start"
                    @update:model-value="value => choose(value)"
                />
                <p v-if="shown === 'google'" class="text-sm text-muted">{{ t('Best value of all services: the most free hours and natural voices.') }}</p>
                <p v-if="shown === 'device'" class="text-sm text-muted">{{ t('Your device\'s own voice reads aloud.') }}</p>
                <div v-else-if="!showForm" class="flex flex-wrap items-center gap-3">
                    <span class="flex h-9 items-center gap-2 text-sm">
                        <UIcon name="i-heroicons-check-circle" class="size-5 text-success" />
                        {{ t('{service} · key saved', { service: shownLabel }) }}
                    </span>
                    <UButton :label="t('Replace key')" color="neutral" variant="outline" @click="replacing = true" />
                    <UButton :label="t('Remove')" color="neutral" variant="ghost" @click="confirmingRemove = true" />
                </div>
                <p v-if="problem && problem.provider === shown" class="flex items-start gap-2 rounded-lg bg-warning/10 px-3 py-2 text-sm">
                    <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 size-4 shrink-0 text-warning" />
                    <span>{{ t(PROBLEM_TEXTS[problem.reason], { service: shownLabel }) }}</span>
                </p>
                <div v-if="shown !== 'device' && !showForm" class="grid gap-6 sm:grid-cols-2">
                    <div class="flex flex-col gap-1.5">
                        <p class="text-sm font-medium text-highlighted">{{ t('Quality') }}</p>
                        <button
                            v-for="model in SPEECH_MODELS[shown]"
                            :key="model.id"
                            type="button"
                            class="flex h-9 items-center gap-2 rounded-md px-3 text-start text-sm ring transition-colors duration-500 ease-out"
                            :class="services?.models[shown] === model.id ? 'bg-primary/10 text-primary ring-primary/40' : 'ring-default hover:bg-primary/8'"
                            @click="chooseModel(shown, model.id)"
                        >
                            <span class="flex-1 font-medium">{{ model.label }}</span>
                            <span v-if="model.freeHoursPerMonth && model.freeHoursPerMonth < 1" class="text-muted tabular-nums">{{ t('{minutes} min free monthly, then {price}/h', { minutes: Math.round(model.freeHoursPerMonth * 60), price: formatDollars(model.dollarsPerHour) }) }}</span>
                            <span v-else-if="model.freeHoursPerMonth" class="text-muted tabular-nums">{{ t('{hours} h free monthly, then {price}/h', { hours: model.freeHoursPerMonth, price: formatDollars(model.dollarsPerHour) }) }}</span>
                            <span v-else class="text-muted tabular-nums">{{ t('about {price} per hour', { price: formatDollars(model.dollarsPerHour) }) }}</span>
                        </button>
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <p class="text-sm font-medium text-highlighted">{{ t('Voice') }}</p>
                        <template v-if="loadingVoices">
                            <USkeleton v-for="voice in distinctVoices" :key="voice.id" class="h-9 w-full rounded-md" />
                        </template>
                        <div
                            v-for="voice in loadingVoices ? [] : distinctVoices"
                            :key="voice.id"
                            class="flex h-9 items-center gap-1 rounded-md ps-3 pe-1 text-sm ring transition-colors duration-500 ease-out"
                            :class="chosenVoice === voice.id ? 'bg-primary/10 text-primary ring-primary/40' : 'ring-default hover:bg-primary/8'"
                        >
                            <button type="button" class="flex h-full flex-1 items-center text-start font-medium" @click="setSpeechVoice(shown, voice.id)">
                                {{ voice.label }}
                            </button>
                            <UTooltip :text="playing === voice.id ? t('Stop sample') : t('Play sample')">
                                <UButton
                                    :icon="playing === voice.id ? 'i-heroicons-stop' : 'i-heroicons-play'"
                                    :loading="loadingSample === voice.id"
                                    color="neutral"
                                    variant="ghost"
                                    size="sm"
                                    :aria-label="playing === voice.id ? t('Stop sample') : t('Play sample')"
                                    @click="playSample(shown, voice.id)"
                                />
                            </UTooltip>
                        </div>
                    </div>
                </div>
                <form v-if="showForm" class="flex flex-col gap-3 sm:max-w-md" @submit.prevent="save">
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
