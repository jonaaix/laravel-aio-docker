<script setup lang="ts">
import type { Participant } from '~/utils/avatars';

defineProps<{
    participants: Participant[];
}>();
</script>

<template>
    <ul class="flex w-48 flex-col gap-1">
        <li v-for="participant in participants" :key="`${participant.kind}:${participant.name}`" class="flex h-8 items-center gap-2">
            <span class="flex size-7 shrink-0 items-center justify-center">
                <ParticipantAvatar :participant="participant" :class="isVoxelBot(participant) ? 'size-7' : 'size-6'" />
            </span>
            <span class="min-w-0 truncate text-sm text-default">{{ participant.name }}</span>
        </li>
    </ul>
</template>
