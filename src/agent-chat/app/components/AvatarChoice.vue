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

const rows = computed(() => props.presets?.length ? [seeds.value, props.presets] : [seeds.value]);

onMounted(shuffle);
</script>

<template>
    <div class="flex flex-wrap items-center gap-2 rounded-md p-2 ring ring-default">
        <template v-for="(row, index) in rows" :key="index">
            <div v-if="index > 0" class="basis-full" />
            <button
                v-for="seed in row"
                :key="seed"
                type="button"
                class="flex size-14 items-center justify-center rounded-md transition-colors duration-500 ease-out hover:bg-elevated"
                :class="seed === current ? 'bg-accented/60' : ''"
                :aria-label="`Use avatar ${seed}`"
                @click="emit('select', seed)"
            >
                <ParticipantAvatar :participant="{ kind, name: seed, seed }" :class="isVoxelBot({ kind, name: seed, seed }) ? 'size-12' : 'size-9.5'" />
            </button>
            <UTooltip v-if="index === 0" text="Shuffle">
                <UButton icon="i-heroicons-arrow-path" aria-label="Shuffle" color="neutral" variant="ghost" @click="shuffle" />
            </UTooltip>
        </template>
    </div>
</template>
