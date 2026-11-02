<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui';
import type { Participant } from '~/utils/avatars';

export interface AgentOption {
    id: string;
    name: string;
    member: boolean;
}

const props = defineProps<{
    participants: Participant[];
    agentOptions: AgentOption[];
    editable: boolean;
}>();

const emit = defineEmits<{ toggle: [agentId: string, member: boolean] }>();

const agentsWindow = useAgentsWindow();

const menuItems = computed<DropdownMenuItem[][]>(() => [
    props.agentOptions.map(option => ({
        label: option.name,
        type: 'checkbox' as const,
        checked: option.member,
        onUpdateChecked: (checked: boolean) => emit('toggle', option.id, checked),
        onSelect: (event: Event) => event.preventDefault(),
    })),
    [{
        label: 'Manage agents',
        icon: 'i-heroicons-cog-6-tooth',
        onSelect: agentsWindow.open,
    }],
].filter(group => group.length > 0));
</script>

<template>
    <UModal title="Participants">
        <button type="button" class="flex items-center -space-x-2" aria-label="Participants">
            <ParticipantAvatar
                v-for="participant in participants"
                :key="`${participant.kind}:${participant.name}`"
                :participant="participant"
                :class="isVoxelBot(participant) ? 'size-9' : 'size-7'"
            />
        </button>
        <template #body>
            <ChatParticipantList :participants="participants" />
            <UDropdownMenu v-if="editable" :items="menuItems" :content="{ align: 'start' }">
                <UButton label="Add agent" icon="i-heroicons-plus" color="neutral" variant="ghost" class="mt-2 -ms-2" />
            </UDropdownMenu>
        </template>
    </UModal>
</template>
