<script setup lang="ts">
import type { DiffLine } from '~/utils/line-diff';

const props = defineProps<{
    lines: DiffLine[];
    language: string | null;
}>();

const code = computed(() => props.lines.map(line => line.kind === 'gap' ? '' : line.text).join('\n'));
const tokens = useCodeTokens(code, () => props.language);

const lineClass: Record<DiffLine['kind'], string> = {
    added: 'bg-success/10 text-success',
    removed: 'bg-error/10 text-error',
    same: 'text-toned',
    gap: 'text-dimmed',
};
const linePrefix: Record<DiffLine['kind'], string> = { added: '+ ', removed: '- ', same: '  ', gap: '  ' };
</script>

<template>
    <div class="overflow-auto rounded-md bg-elevated py-2 font-mono text-xs/5">
        <div v-for="(line, index) in lines" :key="index" class="px-3 whitespace-pre-wrap [overflow-wrap:anywhere]" :class="lineClass[line.kind]">{{ linePrefix[line.kind] }}<ChatCodeLine :text="line.text" :tokens="line.kind === 'gap' ? undefined : tokens?.[index]" /></div>
    </div>
</template>
