<script setup lang="ts">
import type { ChatStatus } from 'ai';

const MAX_ROWS = 10;

const text = defineModel<string>({ required: true });

const props = defineProps<{
    placeholder: string;
    status: ChatStatus;
    error?: Error;
    disabled?: boolean;
    autofocus?: boolean;
}>();

const emit = defineEmits<{ submit: []; stop: [] }>();

const empty = computed(() => text.value.trim() === '');
</script>

<template>
    <UChatPrompt
        v-model="text"
        variant="outline"
        color="neutral"
        :placeholder="placeholder"
        :error="error"
        :disabled="disabled"
        :autofocus="autofocus"
        :maxrows="MAX_ROWS"
        :ui="{ body: 'items-end ps-3', base: 'py-2 text-base/5' }"
        @submit="emit('submit')"
    >
        <UChatPromptSubmit
            :status="props.status"
            :disabled="props.status === 'ready' && empty"
            color="neutral"
            class="shrink-0 disabled:opacity-40"
            @stop="emit('stop')"
        />
    </UChatPrompt>
</template>
