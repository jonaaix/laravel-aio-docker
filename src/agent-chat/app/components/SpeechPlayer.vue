<script setup lang="ts">
const SEEK_DELAY_MS = 300;
const PROGRESS_STEPS = 1000;

const { t } = useI18n();
const { conversations } = useConversations();
const { speechRate } = useAppearance();
const { speakingId, conversationId, paused, progress, pause, resume, back, seek, stop } = useSpeechPlayer();

const draftProgress = ref<number | null>(null);
let seekTimer: ReturnType<typeof setTimeout> | undefined;

const title = computed(() => conversations.value.find(conversation => conversation.id === conversationId.value)?.title ?? t('Read aloud'));
const shownProgress = computed(() => draftProgress.value ?? Math.round(progress.value * PROGRESS_STEPS));

function moveProgress(value: number | undefined): void {
    if (value === undefined) {
        return;
    }
    draftProgress.value = value;
    clearTimeout(seekTimer);
    seekTimer = setTimeout(() => {
        seek(value / PROGRESS_STEPS);
        draftProgress.value = null;
    }, SEEK_DELAY_MS);
}

function togglePause(): void {
    if (paused.value) {
        resume();
    }
    else {
        pause();
    }
}
</script>

<template>
    <div v-if="speakingId" class="flex flex-col gap-2 rounded-xl bg-default p-3 ring ring-default">
        <div class="flex min-w-0 items-center gap-2">
            <AudioLevelBars :playing="!paused" :label="paused ? t('Paused') : t('Reading aloud')" />
            <NuxtLink v-if="conversationId" :to="`/c/${conversationId}`" class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted hover:underline">{{ title }}</NuxtLink>
            <span v-else class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ title }}</span>
            <UTooltip :text="t('Stop reading')">
                <UButton icon="i-heroicons-x-mark" color="neutral" variant="ghost" size="xs" :aria-label="t('Stop reading')" @click="stop" />
            </UTooltip>
        </div>
        <USlider
            :model-value="shownProgress"
            :min="0"
            :max="PROGRESS_STEPS"
            size="xs"
            :aria-label="t('Reading position')"
            @update:model-value="moveProgress"
        />
        <div class="flex items-center gap-1">
            <UTooltip :text="t('Back 10 seconds')">
                <UButton icon="i-heroicons-backward" color="neutral" variant="ghost" size="sm" :aria-label="t('Back 10 seconds')" @click="back" />
            </UTooltip>
            <UTooltip :text="paused ? t('Resume') : t('Pause')">
                <UButton :icon="paused ? 'i-heroicons-play' : 'i-heroicons-pause'" color="neutral" variant="ghost" size="sm" :aria-label="paused ? t('Resume') : t('Pause')" @click="togglePause" />
            </UTooltip>
            <UPopover :content="{ side: 'top', align: 'end' }">
                <UButton :label="formatSpeedFactor(speechRate)" color="neutral" variant="ghost" size="sm" class="ms-auto tabular-nums" :aria-label="t('Reading speed')" />
                <template #content>
                    <SpeechRateSlider :label="t('Reading speed')" class="w-64 px-3" />
                </template>
            </UPopover>
        </div>
    </div>
</template>
