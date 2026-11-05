<script setup lang="ts">
defineProps<{
    letter: string;
    selected: boolean;
    disabled: boolean;
}>();

defineEmits<{ pick: [] }>();
</script>

<template>
    <button
        type="button"
        :disabled="disabled"
        :aria-pressed="selected"
        class="flex w-full items-start gap-2 rounded-sm px-2 py-0.5 text-start text-[calc(var(--text-base)-1px)] transition-colors duration-500 ease-out disabled:cursor-default"
        :class="selected ? 'bg-primary/10 text-primary ring ring-inset ring-primary/40' : 'text-default enabled:hover:bg-primary/8'"
        @click="$emit('pick')"
    >
        <span class="shrink-0 font-semibold" :class="selected ? '' : 'text-muted'">{{ letter }})</span>
        <div class="min-w-0 flex-1">
            <slot />
        </div>
        <UIcon v-if="selected" name="i-heroicons-check" class="mt-1 size-4 shrink-0" />
    </button>
</template>
