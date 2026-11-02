<script setup lang="ts">
import type { Participant } from '~/utils/avatars';

defineProps<{
    participant: Participant;
    label?: string;
}>();
</script>

<template>
    <img
        :src="avatarUri(participant)"
        :alt="label ?? ''"
        class="shrink-0 rounded-full bg-neutral-100 ring ring-default dark:bg-neutral-300 dark:ring-2 dark:ring-neutral-400"
    >
</template>
