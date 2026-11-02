<script setup lang="ts">
import type { Participant } from '~/utils/avatars';

defineProps<{
    participants: Participant[];
}>();
</script>

<template>
    <div class="flex -space-x-2">
        <UTooltip v-for="participant in participants" :key="`${participant.kind}:${participant.name}`" :text="participant.name">
            <img
                :src="avatarUri(participant)"
                :alt="participant.name"
                class="size-7 rounded-full bg-elevated ring-2 ring-(--ui-bg)"
            >
        </UTooltip>
    </div>
</template>
