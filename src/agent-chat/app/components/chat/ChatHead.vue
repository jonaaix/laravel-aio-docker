<script setup lang="ts">
import type { Participant } from '~/utils/avatars';

const NON_BREAKING_HYPHEN = '\u2011';

const props = defineProps<{
    participant: Participant;
}>();

const label = computed(() => props.participant.name.replaceAll('-', NON_BREAKING_HYPHEN));
</script>

<template>
    <div class="flex w-16 shrink-0 flex-col items-center gap-1 sm:w-24">
        <ParticipantAvatar :participant="participant" class="size-8 sm:size-11" />
        <span
            v-if="participant.name"
            class="max-w-full rounded-md bg-elevated px-1.5 py-0.5 text-center text-[0.625rem]/3.5 font-medium text-default [overflow-wrap:anywhere] sm:text-xs/4"
        >
            {{ label }}
        </span>
    </div>
</template>
