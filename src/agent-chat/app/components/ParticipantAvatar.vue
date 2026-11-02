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
        :class="[framed ? 'rounded-full object-cover' : '', participant.image ? 'ring ring-default' : '']"
    >
</template>
