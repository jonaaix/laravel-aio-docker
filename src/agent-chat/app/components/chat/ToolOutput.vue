<script setup lang="ts">
const props = defineProps<{
    text: string;
    language: string | null;
}>();

const tokens = useCodeTokens(() => props.text, () => props.language);
const lines = computed(() => props.text.split('\n'));
</script>

<template>
    <pre class="max-h-96 overflow-auto rounded-md bg-elevated p-3 whitespace-pre-wrap text-default"><ChatCodeLines :lines="lines" :tokens="tokens" /></pre>
</template>
