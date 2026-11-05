<script setup lang="ts">
const props = defineProps<{
    text: string;
    messageId: string;
}>();

const { t } = useI18n();
const { supported, speakingId, preparingId, speak } = useSpeech();
const { paused, pause, resume } = useSpeechPlayer();

const speaking = computed(() => speakingId.value === props.messageId);
const preparing = computed(() => preparingId.value === props.messageId);

const label = computed(() => {
    if (!speaking.value) {
        return t('Read aloud');
    }
    return paused.value ? t('Resume') : t('Pause');
});
const icon = computed(() => {
    if (preparing.value) {
        return 'i-heroicons-arrow-path';
    }
    if (!speaking.value) {
        return 'i-heroicons-speaker-wave';
    }
    return paused.value ? 'i-heroicons-play' : 'i-heroicons-pause';
});

function toggle(): void {
    if (!speaking.value) {
        speak(props.messageId, props.text);
    }
    else if (paused.value) {
        resume();
    }
    else {
        pause();
    }
}
</script>

<template>
    <UTooltip v-if="supported" :text="label">
        <UButton
            :icon="icon"
            :ui="{ leadingIcon: preparing ? 'animate-spin' : '' }"
            :aria-label="label"
            size="xs"
            color="neutral"
            variant="ghost"
            :data-speaking="speaking || undefined"
            @click="toggle"
        />
    </UTooltip>
</template>
