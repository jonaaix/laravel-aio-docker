<script setup lang="ts">
import type { Participant } from '~/utils/avatars';

defineProps<{
    participants: Participant[];
    compact?: boolean;
}>();
</script>

<template>
    <UModal v-if="compact" title="Participants">
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
        </template>
    </UModal>
    <ChatParticipantList v-else :participants="participants" />
</template>
