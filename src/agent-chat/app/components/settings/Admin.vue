<script setup lang="ts">
const { t } = useI18n();
const { title, save } = useChatTitle();

const draft = ref(title.value ?? '');
const saving = ref(false);
const error = ref<string | undefined>();

watch(title, (value) => {
    draft.value = value ?? '';
});

async function commit(): Promise<void> {
    if ((draft.value.trim() || null) === title.value) {
        return;
    }
    saving.value = true;
    error.value = undefined;
    try {
        await save(draft.value);
    }
    catch {
        error.value = t('Could not save the chat title');
    }
    finally {
        saving.value = false;
    }
}
</script>

<template>
    <div class="flex flex-col gap-6">
        <UFormField :label="t('Chat title')" :error="error">
            <UInput
                v-model="draft"
                placeholder="AI Chat"
                :maxlength="60"
                :loading="saving"
                class="w-full sm:w-64"
                @blur="commit"
                @keydown.enter="commit"
                @keydown.esc="draft = title ?? ''"
            />
        </UFormField>
        <UFormField :label="t('People')">
            <SettingsPeople />
        </UFormField>
    </div>
</template>
