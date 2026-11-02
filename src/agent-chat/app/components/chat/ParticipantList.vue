<script setup lang="ts">
import type { Participant } from '~/utils/avatars';

defineProps<{
    participants: Participant[];
}>();
</script>

<template>
    <ul class="flex w-48 flex-col gap-1">
        <li v-for="participant in participants" :key="`${participant.kind}:${participant.name}`" class="flex h-8 items-center gap-2">
            <ParticipantAvatar :participant="participant" class="size-6 shrink-0" />
            <span class="min-w-0 truncate text-sm text-default">{{ participant.name }}</span>
            <span class="ms-auto">
                <slot name="trailing" :participant="participant" />
            </span>
        </li>
    </ul>
</template>
