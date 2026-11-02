<script setup lang="ts">
import type { ParticipantKind } from '~/utils/avatars';

const CHOICES = 8;

const props = defineProps<{
    kind: ParticipantKind;
    current: string | null;
    presets?: string[];
}>();

const emit = defineEmits<{ select: [seed: string] }>();

const seeds = ref<string[]>([]);

function shuffle(): void {
    const kept = props.current && !props.presets?.includes(props.current) ? [props.current] : [];
    seeds.value = [...kept, ...randomAvatarSeeds(CHOICES - kept.length)];
}

onMounted(shuffle);
</script>

<template>
    <div class="flex flex-wrap items-center gap-2 rounded-md p-2 ring ring-default">
        <button
            v-for="seed in presets ?? []"
            :key="seed"
            type="button"
            class="rounded-md p-1 transition-colors duration-500 ease-out hover:bg-elevated"
            :class="seed === current ? 'bg-accented/60' : ''"
            :aria-label="`Use avatar ${seed}`"
            @click="emit('select', seed)"
        >
            <ParticipantAvatar :participant="{ kind, name: seed, seed }" class="size-12" />
        </button>
        <div v-if="presets?.length" class="basis-full" />
        <button
            v-for="seed in seeds"
            :key="seed"
            type="button"
            class="rounded-md p-1 transition-colors duration-500 ease-out hover:bg-elevated"
            :class="seed === current ? 'bg-accented/60' : ''"
            :aria-label="`Use avatar ${seed}`"
            @click="emit('select', seed)"
        >
            <ParticipantAvatar :participant="{ kind, name: seed, seed }" class="size-12" />
        </button>
        <UTooltip text="Shuffle">
            <UButton icon="i-heroicons-arrow-path" aria-label="Shuffle" color="neutral" variant="ghost" @click="shuffle" />
        </UTooltip>
    </div>
</template>
