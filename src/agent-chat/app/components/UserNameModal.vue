<script setup lang="ts">
const { t } = useI18n();
const { name, ready } = useUserName();

const open = computed(() => ready.value && !name.value);
</script>

<template>
    <!-- Without a name nothing can be attributed, so the first prompt cannot be dismissed. -->
    <UModal
        :open="open"
        :title="t('Your name')"
        :dismissible="false"
        :close="false"
        :ui="{ content: 'sm:max-w-2xl', footer: 'justify-end' }"
    >
        <template #body>
            <SettingsProfile actions-target="#user-name-actions" />
        </template>
        <template #footer>
            <div id="user-name-actions" class="flex w-full items-center justify-between gap-2" />
        </template>
    </UModal>
</template>
