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
const busy = computed(() => props.status === 'submitted' || props.status === 'streaming');
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
        <UTooltip :text="busy ? 'Stop' : 'Send'">
            <UChatPromptSubmit
                :status="props.status"
                :disabled="props.status === 'ready' && empty"
                :aria-label="busy ? 'Stop' : 'Send'"
                color="neutral"
                class="shrink-0 disabled:opacity-40"
                @stop="emit('stop')"
            />
        </UTooltip>
    </UChatPrompt>
</template>
