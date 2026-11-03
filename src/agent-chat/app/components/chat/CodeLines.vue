<script setup lang="ts">
import type { ThemedToken } from 'shiki/core';

defineProps<{
    lines: string[];
    tokens: ThemedToken[][] | null;
}>();
</script>

<template>
    <template v-for="(line, index) in lines" :key="index"><ChatCodeLine :text="line" :tokens="tokens?.[index]" />{{ index < lines.length - 1 ? '\n' : '' }}</template>
</template>
