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
    <div class="me-2 flex items-center">
        <UModal title="Participants">
            <button type="button" class="flex items-center -space-x-2.5" aria-label="Participants">
                <ParticipantAvatar
                    v-for="participant in participants"
                    :key="`${participant.kind}:${participant.name}`"
                    :participant="participant"
                    class="size-9 rounded-full ring ring-accented"
                    :class="isVoxelBot(participant) ? 'bg-elevated' : ''"
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
            </template>
        </UModal>
        <UDropdownMenu v-if="editable" :items="menuItems" :content="{ align: 'end' }">
            <UTooltip text="Agents">
                <button
                    type="button"
                    aria-label="Agents"
                    class="-ms-2 flex size-9 items-center justify-center rounded-full bg-default text-muted ring ring-accented transition-colors hover:text-default"
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
