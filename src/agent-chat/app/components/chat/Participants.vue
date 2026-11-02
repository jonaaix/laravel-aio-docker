<script setup lang="ts">
import type { Participant } from '~/utils/avatars';

defineProps<{
    participants: Participant[];
}>();
</script>

<template>
    <div class="flex items-center -space-x-2">
        <UTooltip v-for="participant in participants" :key="`${participant.kind}:${participant.name}`" :text="participant.name">
            <ParticipantAvatar :participant="participant" :label="participant.name" :class="participant.kind === 'agent' ? 'size-9' : 'size-7'" />
        </UTooltip>
    </div>
</template>
