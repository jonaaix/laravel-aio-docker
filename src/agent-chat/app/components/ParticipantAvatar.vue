<script setup lang="ts">
import type { Participant } from '~/utils/avatars';

const props = defineProps<{
    participant: Participant;
    label?: string;
}>();

const framed = computed(() => props.participant.kind === 'person' || !!props.participant.image);
</script>

<template>
    <img
        :src="avatarUri(participant)"
        :alt="label ?? ''"
        class="shrink-0"
        :class="framed ? 'rounded-full bg-neutral-100 object-cover ring ring-default dark:bg-neutral-300 dark:ring-2 dark:ring-neutral-400' : ''"
    >
</template>
