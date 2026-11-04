<script setup lang="ts">
const props = defineProps<{
    text: string;
    messageId: string;
}>();

const { t } = useI18n();
const { supported, speakingId, speak, stop } = useSpeech();

const speaking = computed(() => speakingId.value === props.messageId);

function toggle(): void {
    if (speaking.value) {
        stop();
        return;
    }
    speak(props.messageId, props.text);
}

onBeforeUnmount(() => {
    if (speaking.value) {
        stop();
    }
});
</script>

<template>
    <UTooltip v-if="supported" :text="speaking ? t('Stop reading') : t('Read aloud')">
        <UButton
            :icon="speaking ? 'i-heroicons-stop' : 'i-heroicons-speaker-wave'"
            :aria-label="speaking ? t('Stop reading') : t('Read aloud')"
            size="xs"
            color="neutral"
            variant="ghost"
            :data-speaking="speaking || undefined"
            @click="toggle"
        />
    </UTooltip>
</template>
