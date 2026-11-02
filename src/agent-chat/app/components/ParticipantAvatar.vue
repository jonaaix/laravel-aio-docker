<script setup lang="ts">
import type { Participant } from '~/utils/avatars';

const props = defineProps<{
    participant: Participant;
    label?: string;
}>();

const frame = computed(() => props.participant.kind === 'person'
    ? 'rounded-full bg-neutral-100 ring ring-default dark:bg-neutral-300 dark:ring-2 dark:ring-neutral-400'
    : '');
</script>

<template>
    <img :src="avatarUri(participant)" :alt="label ?? ''" class="shrink-0" :class="frame">
</template>
