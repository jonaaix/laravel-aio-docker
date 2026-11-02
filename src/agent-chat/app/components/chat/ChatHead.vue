<script setup lang="ts">
import type { Participant } from '~/utils/avatars';

defineProps<{
    participant: Participant;
}>();
</script>

<template>
    <div class="flex w-12 shrink-0 flex-col items-center gap-1 sm:w-[4.5rem]">
        <img :src="avatarUri(participant)" alt="" class="size-8 rounded-full bg-elevated ring ring-default sm:size-11">
        <span
            v-if="participant.name"
            class="max-w-full truncate rounded-full bg-elevated px-2 py-0.5 text-[0.625rem]/3.5 font-medium text-default sm:text-xs/4"
        >
            {{ participant.name }}
        </span>
    </div>
</template>
