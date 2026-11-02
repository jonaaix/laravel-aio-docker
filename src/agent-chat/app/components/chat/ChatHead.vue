<script setup lang="ts">
import type { Participant } from '~/utils/avatars';

const NON_BREAKING_HYPHEN = '‑';

const props = defineProps<{
    participant: Participant;
    reverse?: boolean;
}>();

const label = computed(() => props.participant.name.replaceAll('-', NON_BREAKING_HYPHEN));
const freeStanding = computed(() => isVoxelBot(props.participant));
</script>

<template>
    <div
        class="flex shrink-0 items-center gap-2 select-none sm:w-24 sm:flex-col sm:gap-1"
        :class="reverse ? 'flex-row-reverse' : 'flex-row'"
    >
        <ParticipantAvatar :participant="participant" :class="freeStanding ? 'size-8 sm:size-11' : 'size-6 sm:size-9'" />
        <span
            v-if="participant.name"
            class="rounded-md bg-elevated px-1.5 py-0.5 text-xs/4 font-medium text-default sm:max-w-full sm:text-center sm:[overflow-wrap:anywhere]"
        >
            {{ label }}
        </span>
    </div>
</template>
