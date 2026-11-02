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

const agentsWindow = useAgentsWindow();

function memberOption(participant: Participant): AgentOption | null {
    return participant.kind === 'agent' ? props.agentOptions.find(option => option.member && option.name === participant.name) ?? null : null;
}

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
            <ChatParticipantList :participants="participants">
                <template #trailing="{ participant }">
                    <UTooltip v-if="editable && memberOption(participant)" text="Remove">
                        <UButton
                            icon="i-heroicons-x-mark"
                            color="neutral"
                            variant="ghost"
                            size="xs"
                            aria-label="Remove"
                            class="text-dimmed"
                            @click="emit('toggle', memberOption(participant)!.id, false)"
                        />
                    </UTooltip>
                </template>
            </ChatParticipantList>
            <UDropdownMenu v-if="editable" :items="menuItems" :content="{ align: 'start' }">
                <UButton label="Add agent" icon="i-heroicons-plus" color="neutral" variant="ghost" class="mt-2 -ms-2" />
                <template #item-leading="{ item }">
                    <span v-if="item.participant" class="flex size-6 shrink-0 items-center justify-center">
                        <ParticipantAvatar :participant="item.participant" :class="isVoxelBot(item.participant) ? 'size-6' : 'size-5'" />
                    </span>
                    <UIcon v-else-if="item.icon" :name="item.icon" class="size-5 shrink-0 text-dimmed" />
                </template>
            </UDropdownMenu>
        </template>
    </UModal>
</template>
