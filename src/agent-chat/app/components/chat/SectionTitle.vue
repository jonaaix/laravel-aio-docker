<script setup lang="ts">
const LEADING_EMOJI = /^(\p{Extended_Pictographic}️?)\s*(.*)$/u;

const props = defineProps<{
    title: string;
}>();

const parts = computed(() => {
    const match = LEADING_EMOJI.exec(props.title);
    return match ? { emoji: match[1]!, text: match[2]! } : { emoji: '', text: props.title };
});
</script>

<template>
    <span class="flex items-center gap-2">
        <span v-if="parts.emoji" class="text-[1.25em]/none" aria-hidden="true">{{ parts.emoji }}</span>
        <span>{{ parts.text }}</span>
    </span>
</template>
