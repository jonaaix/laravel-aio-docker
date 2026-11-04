<script setup lang="ts">
const { t } = useI18n();
const { pinSentMessage, changesPanelAuto, setPinSentMessage, setChangesPanelAuto } = useAppearance();
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
            id="setting-file-changes-auto"
            :model-value="changesPanelAuto"
            :label="t('Show file changes automatically')"
            @update:model-value="value => setChangesPanelAuto(value === true)"
        />
    </div>
</template>
