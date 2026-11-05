<script setup lang="ts">
const { t } = useI18n();
const { pinSentMessage, changesPanelAuto, doneSound, thinkingAutoOpen, workingAutoOpen, setPinSentMessage, setChangesPanelAuto, setDoneSound, setThinkingAutoOpen, setWorkingAutoOpen } = useAppearance();
</script>

<template>
    <div class="flex max-w-xl flex-col gap-6">
        <UFormField :label="t('Sending')">
            <USwitch
                id="setting-pin-sent-message"
                :model-value="pinSentMessage"
                :label="t('Move sent message to top')"
                @update:model-value="value => setPinSentMessage(value === true)"
            />
        </UFormField>
        <UFormField :label="t('Agent activity')">
            <div class="flex flex-col gap-3">
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
            </div>
        </UFormField>
        <UFormField :label="t('Sound')">
            <USwitch
                id="setting-done-sound"
                :model-value="doneSound"
                :label="t('Sound when a chat is done')"
                @update:model-value="value => setDoneSound(value === true)"
            />
        </UFormField>
    </div>
</template>
