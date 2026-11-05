<script setup lang="ts">
const { t } = useI18n();
const { pinSentMessage, changesPanelAuto, doneSound, scaledPreviews, thinkingAutoOpen, workingAutoOpen, setPinSentMessage, setChangesPanelAuto, setDoneSound, setScaledPreviews, setThinkingAutoOpen, setWorkingAutoOpen } = useAppearance();
</script>

<template>
    <div class="flex max-w-xl flex-col gap-4">
        <USwitch
            id="setting-pin-sent-message"
            :model-value="pinSentMessage"
            :label="t('Move sent message to top')"
            @update:model-value="value => setPinSentMessage(value === true)"
        />
        <USwitch
            id="setting-thinking-auto-open"
            :model-value="thinkingAutoOpen"
            :label="t('Expand thinking automatically')"
            @update:model-value="value => setThinkingAutoOpen(value === true)"
        />
        <USwitch
            id="setting-working-auto-open"
            :model-value="workingAutoOpen"
            :label="t('Expand work steps automatically')"
            @update:model-value="value => setWorkingAutoOpen(value === true)"
        />
        <USwitch
            id="setting-file-changes-auto"
            :model-value="changesPanelAuto"
            :label="t('Show file changes automatically')"
            @update:model-value="value => setChangesPanelAuto(value === true)"
        />
        <USwitch
            id="setting-done-sound"
            :model-value="doneSound"
            :label="t('Sound when a chat is done')"
            @update:model-value="value => setDoneSound(value === true)"
        />
        <USwitch
            id="setting-scaled-previews"
            :model-value="scaledPreviews"
            :label="t('Show variants at original width')"
            @update:model-value="value => setScaledPreviews(value === true)"
        />
    </div>
</template>
