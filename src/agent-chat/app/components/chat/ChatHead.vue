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
        class="flex shrink-0 flex-col gap-1 select-none @min-[48rem]:w-24 @min-[48rem]:items-center"
        :class="reverse ? 'items-end' : 'items-start'"
    >
        <ParticipantAvatar :participant="participant" :class="freeStanding ? 'size-11' : 'size-10'" />
        <span
            v-if="participant.name"
            class="max-w-full rounded-md bg-elevated px-1.5 py-0.5 text-xs/4 font-medium text-default [overflow-wrap:anywhere] @min-[48rem]:text-center"
        >
            {{ label }}
        </span>
    </div>
</template>
