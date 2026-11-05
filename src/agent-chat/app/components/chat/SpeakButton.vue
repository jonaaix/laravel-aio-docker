<script setup lang="ts">
const props = defineProps<{
    text: string;
    messageId: string;
}>();

const { t } = useI18n();
const { supported, speakingId, preparingId, speak, stop } = useSpeech();

const speaking = computed(() => speakingId.value === props.messageId);
const preparing = computed(() => preparingId.value === props.messageId);

function toggle(): void {
    if (speaking.value) {
        stop();
        return;
    }
    speak(props.messageId, props.text);
}
</script>

<template>
    <UTooltip v-if="supported" :text="speaking ? t('Stop reading') : t('Read aloud')">
        <UButton
            :icon="preparing ? 'i-heroicons-arrow-path' : speaking ? 'i-heroicons-stop' : 'i-heroicons-speaker-wave'"
            :ui="{ leadingIcon: preparing ? 'animate-spin' : '' }"
            :aria-label="speaking ? t('Stop reading') : t('Read aloud')"
            size="xs"
            color="neutral"
            variant="ghost"
            :data-speaking="speaking || undefined"
            @click="toggle"
        />
    </UTooltip>
</template>
