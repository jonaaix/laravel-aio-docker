<script setup lang="ts">
import type { DiffLine } from '~/utils/line-diff';

const props = defineProps<{
    lines: DiffLine[];
    language: string | null;
}>();

const code = computed(() => props.lines.map(line => line.kind === 'gap' ? '' : line.text).join('\n'));
const tokens = useCodeTokens(code, () => props.language);
const numberWidth = computed(() => {
    const largest = Math.max(0, ...props.lines.map(line => line.number ?? 0));
    return largest > 0 ? `calc(${String(largest).length}ch + 0.75rem)` : null;
});

const lineClass: Record<DiffLine['kind'], string> = {
    added: 'bg-success/6 text-default',
    removed: 'bg-error/6 text-default',
    same: 'text-toned',
    gap: 'text-dimmed',
};
const linePrefix: Record<DiffLine['kind'], string> = { added: '+', removed: '−', same: '', gap: '' };
const prefixClass: Record<DiffLine['kind'], string> = { added: 'text-success', removed: 'text-error', same: '', gap: '' };
</script>

<template>
    <div class="overflow-auto rounded-md bg-elevated py-2 font-mono text-xs/5">
        <div v-for="(line, index) in lines" :key="index" class="flex px-3" :class="lineClass[line.kind]" :data-kind="line.kind">
            <span v-if="numberWidth" class="shrink-0 pe-3 text-end text-dimmed tabular-nums select-none" :style="{ width: numberWidth }">{{ line.number }}</span>
            <span class="w-4 shrink-0 select-none" :class="prefixClass[line.kind]">{{ linePrefix[line.kind] }}</span>
            <span class="min-w-0 flex-1 whitespace-pre-wrap [overflow-wrap:anywhere]"><ChatCodeLine :text="line.text" :tokens="line.kind === 'gap' ? undefined : tokens?.[index]" /></span>
        </div>
    </div>
</template>
