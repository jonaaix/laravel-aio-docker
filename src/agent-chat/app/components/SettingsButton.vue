<script setup lang="ts">
defineProps<{ collapsed: boolean }>();

const settingsWindow = useSettingsWindow();
</script>

<template>
    <UTooltip text="Settings" :disabled="!collapsed">
        <UButton
            icon="i-heroicons-cog-6-tooth"
            :label="collapsed ? undefined : 'Settings'"
            aria-label="Settings"
            color="neutral"
            variant="ghost"
            :square="collapsed"
            :block="!collapsed"
            class="justify-start hover:bg-accented/60"
            @click="settingsWindow.open()"
        />
    </UTooltip>
</template>
