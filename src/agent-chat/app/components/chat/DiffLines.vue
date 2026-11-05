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
    added: 'bg-(--diff-added) text-default',
    removed: 'bg-(--diff-removed) text-default',
    same: 'text-default',
    gap: 'bg-(--diff-gap) text-dimmed',
};
const gutterClass: Record<DiffLine['kind'], string> = {
    added: 'bg-(--diff-added-gutter)',
    removed: 'bg-(--diff-removed-gutter)',
    same: '',
    gap: '',
};
const linePrefix: Record<DiffLine['kind'], string> = { added: '+', removed: '−', same: '', gap: '' };
</script>

<template>
    <div class="overflow-auto rounded-md bg-default font-mono text-xs/5 ring ring-default">
        <div v-for="(line, index) in lines" :key="index" class="flex" :class="lineClass[line.kind]" :data-kind="line.kind">
            <span v-if="numberWidth" class="shrink-0 px-2 text-end text-dimmed tabular-nums select-none" :class="gutterClass[line.kind]" :style="{ width: `calc(${numberWidth} + 0.25rem)` }">{{ line.number }}</span>
            <span class="w-5 shrink-0 ps-2 select-none text-muted">{{ linePrefix[line.kind] }}</span>
            <span class="min-w-0 flex-1 whitespace-pre-wrap pe-3 [overflow-wrap:anywhere]"><ChatCodeLine :text="line.text" :tokens="line.kind === 'gap' ? undefined : tokens?.[index]" /></span>
        </div>
    </div>
</template>
