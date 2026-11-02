<script setup lang="ts">
import type { ParticipantKind } from '~/utils/avatars';

const CHOICES = 8;

const props = defineProps<{
    kind: ParticipantKind;
    current: string | null;
    presets?: string[][];
    compact?: boolean;
}>();

const emit = defineEmits<{ select: [seed: string] }>();

const seeds = ref<string[]>([]);

function shuffle(): void {
    const kept = props.current && !props.presets?.some(row => row.includes(props.current!)) ? [props.current] : [];
    seeds.value = [...kept, ...randomAvatarSeeds(CHOICES - kept.length)];
}

const rows = computed(() => [seeds.value, ...(props.presets ?? [])]);

onMounted(shuffle);
</script>

<template>
    <div class="flex flex-wrap items-center rounded-md ring ring-default" :class="compact ? 'gap-1 p-1.5' : 'gap-2 p-2'">
        <template v-for="(row, index) in rows" :key="index">
            <div v-if="index > 0" class="basis-full" />
            <button
                v-for="seed in row"
                :key="seed"
                type="button"
                class="flex items-center justify-center rounded-md transition-colors duration-500 ease-out hover:bg-elevated"
                :class="[compact ? 'size-10' : 'size-14', seed === current ? 'bg-accented/60' : '']"
                :aria-label="`Use avatar ${seed}`"
                @click="emit('select', seed)"
            >
                <ParticipantAvatar :participant="{ kind, name: seed, seed }" :class="isVoxelBot({ kind, name: seed, seed }) ? (compact ? 'size-9' : 'size-12') : (compact ? 'size-7' : 'size-9.5')" />
            </button>
            <UTooltip v-if="index === 0" text="Shuffle">
                <UButton icon="i-heroicons-arrow-path" aria-label="Shuffle" color="neutral" variant="ghost" @click="shuffle" />
            </UTooltip>
        </template>
    </div>
</template>
