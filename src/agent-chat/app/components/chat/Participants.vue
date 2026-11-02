<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { Participant } from '~/utils/avatars';

export interface AgentOption {
    id: string;
    name: string;
    member: boolean;
    participant: Participant;
}

const props = defineProps<{
    participants: Participant[];
    agentOptions: AgentOption[];
    editable: boolean;
}>();

const emit = defineEmits<{ toggle: [agentId: string, member: boolean] }>();

const settingsWindow = useSettingsWindow();

const menuItems = computed<DropdownMenuItem[][]>(() => [
    props.agentOptions.map(option => ({
        label: option.name,
        participant: option.participant,
        type: 'checkbox' as const,
        checked: option.member,
        onUpdateChecked: (checked: boolean) => emit('toggle', option.id, checked),
        onSelect: (event: Event) => event.preventDefault(),
    })),
    [{
        label: 'Manage agents',
        icon: 'i-heroicons-cog-6-tooth',
        onSelect: () => settingsWindow.open('agents'),
    }],
].filter(group => group.length > 0));
</script>

<template>
    <div class="me-2 flex items-center">
        <div class="flex items-center -space-x-2.5 lg:space-x-1">
            <UTooltip
                v-for="(participant, index) in participants"
                :key="`${participant.kind}:${participant.name}`"
                :text="participant.name"
            >
                <ParticipantAvatar
                    :participant="participant"
                    :label="participant.name"
                    :style="{ zIndex: participants.length - index }"
                    class="relative size-9 rounded-full ring ring-accented"
                    :class="isVoxelBot(participant) ? 'bg-amber-100 dark:bg-amber-700/40' : ''"
                />
            </UTooltip>
        </div>
        <UDropdownMenu v-if="editable" :items="menuItems" :content="{ align: 'end' }">
            <UTooltip text="Agents">
                <button
                    type="button"
                    aria-label="Agents"
                    class="relative z-0 -ms-2 flex size-9 lg:ms-1 items-center justify-center rounded-full bg-default text-muted ring ring-accented transition-colors hover:text-default"
                >
                    <UIcon name="i-heroicons-plus" class="size-5" />
                </button>
            </UTooltip>
            <template #item-leading="{ item }">
                <ParticipantAvatar v-if="item.participant" :participant="item.participant" class="size-5 shrink-0" />
                <UIcon v-else-if="item.icon" :name="item.icon" class="size-5 shrink-0 text-dimmed" />
            </template>
        </UDropdownMenu>
    </div>
</template>
