<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';

defineProps<{ collapsed: boolean }>();

const colorMode = useColorMode();
const { user, locked: nameLocked, editing: editingName } = useUserName();
const { managing: managingAgents } = useAgents();

const appearances = [
    { label: 'Light', value: 'light', icon: 'i-heroicons-sun' },
    { label: 'Dark', value: 'dark', icon: 'i-heroicons-moon' },
    { label: 'System', value: 'system', icon: 'i-heroicons-computer-desktop' },
] as const;

const nameItems = computed<DropdownMenuItem[]>(() => [
    ...(nameLocked.value && user.value?.avatarLocked ? [] : [{
        label: 'Profile',
        icon: 'i-heroicons-user',
        onSelect: () => {
            editingName.value = true;
        },
    }]),
    {
        label: 'Agents',
        icon: 'i-heroicons-cpu-chip',
        onSelect: () => {
            managingAgents.value = true;
        },
    },
]);

const appearanceItems = computed<DropdownMenuItem[]>(() => [
    { label: 'Appearance', type: 'label' },
    ...appearances.map(appearance => ({
        label: appearance.label,
        icon: appearance.icon,
        type: 'checkbox' as const,
        checked: colorMode.preference === appearance.value,
        onUpdateChecked: () => {
            colorMode.preference = appearance.value;
        },
    })),
]);

const items = computed(() => [nameItems.value, appearanceItems.value].filter(group => group.length > 0));
</script>

<template>
    <UDropdownMenu :items="items" :content="{ side: 'top', align: 'start' }" :ui="{ content: 'w-(--reka-dropdown-menu-trigger-width) min-w-48' }">
        <UTooltip text="Settings" :disabled="!collapsed">
            <UButton
                icon="i-heroicons-cog-6-tooth"
                :label="collapsed ? undefined : 'Settings'"
                aria-label="Settings"
                color="neutral"
                variant="ghost"
                :square="collapsed"
                :block="!collapsed"
                class="justify-start hover:bg-accented/60 data-[state=open]:bg-accented/60"
            />
        </UTooltip>
    </UDropdownMenu>
</template>
