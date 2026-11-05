<script setup lang="ts" generic="T extends string">
export interface OptionStripItem<V extends string> {
    value: V;
    label: string;
    icon?: string;
}

withDefaults(defineProps<{ items: OptionStripItem<T>[]; label: string; size?: 'md' | 'sm' }>(), { size: 'md' });
const model = defineModel<T>({ required: true });
</script>

<template>
    <div role="radiogroup" :aria-label="label" class="flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-elevated dark:bg-elevated/60" :class="size === 'sm' ? 'p-0.5' : 'p-1'">
        <button
            v-for="item in items"
            :key="item.value"
            type="button"
            role="radio"
            :aria-checked="model === item.value"
            class="flex shrink-0 items-center gap-1.5 rounded-full transition-colors duration-150 ease-out"
            :class="[size === 'sm' ? 'h-6 px-2.5 text-xs' : 'h-7 px-3.5 text-sm', model === item.value ? 'bg-default font-medium text-highlighted ring ring-default dark:bg-accented' : 'text-muted hover:text-highlighted']"
            @click="model = item.value"
        >
            <UIcon v-if="item.icon" :name="item.icon" class="size-4 shrink-0" />
            {{ item.label }}
        </button>
    </div>
</template>
