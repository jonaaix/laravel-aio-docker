<script setup lang="ts">
import type { ThemedToken } from 'shiki/core';

defineProps<{
    text: string;
    tokens?: ThemedToken[];
}>();
</script>

<template>
    <span v-if="tokens" class="shiki"><span v-for="(token, index) in tokens" :key="index" :style="token.htmlStyle">{{ token.content }}</span></span>
    <template v-else>{{ text }}</template>
</template>
