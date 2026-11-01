<script setup lang="ts">
import type { DiffLine } from '~/utils/line-diff';

const MAX_DIFF_LINES = 400;
const PREVIEW_LINES = 20;

const props = defineProps<{
    input: unknown;
    label: string;
}>();

const record = computed(() => props.input && typeof props.input === 'object' ? props.input as Record<string, unknown> : {});

const edits = computed(() => {
    const { old_string: before, new_string: after, edits: many } = record.value;
    if (typeof before === 'string' && typeof after === 'string') {
        return [{ before, after }];
    }
    if (Array.isArray(many)) {
        return many
            .map(edit => edit as Record<string, unknown>)
            .filter(edit => typeof edit.old_string === 'string' && typeof edit.new_string === 'string')
            .map(edit => ({ before: edit.old_string as string, after: edit.new_string as string }));
    }
    return [];
});

const diff = computed<DiffLine[]>(() => edits.value.flatMap(edit => {
    const size = edit.before.split('\n').length + edit.after.split('\n').length;
    if (size > MAX_DIFF_LINES) {
        return [
            ...edit.before.split('\n').map(text => ({ kind: 'removed' as const, text })),
            ...edit.after.split('\n').map(text => ({ kind: 'added' as const, text })),
        ];
    }
    return lineDiff(edit.before, edit.after);
}));

const preview = computed(() => {
    const content = record.value.content;
    if (typeof content !== 'string') {
        return null;
    }
    const lines = content.split('\n');
    return { text: lines.slice(0, PREVIEW_LINES).join('\n'), hidden: Math.max(0, lines.length - PREVIEW_LINES) };
});

const command = computed(() => {
    const summary = toolSummary(props.input);
    return summary !== props.label ? summary : '';
});

const lineClass: Record<DiffLine['kind'], string> = {
    added: 'bg-success/10 text-success',
    removed: 'bg-error/10 text-error',
    same: 'text-toned',
};
const linePrefix: Record<DiffLine['kind'], string> = { added: '+ ', removed: '- ', same: '  ' };
</script>

<template>
    <div v-if="diff.length > 0" class="max-h-64 overflow-auto rounded-md bg-elevated py-2 font-mono text-xs/5">
        <div v-for="(line, index) in diff" :key="index" class="px-3 whitespace-pre-wrap [overflow-wrap:anywhere]" :class="lineClass[line.kind]">{{ linePrefix[line.kind] }}{{ line.text }}</div>
    </div>
    <pre v-else-if="preview" class="max-h-64 overflow-auto rounded-md bg-elevated p-3 text-xs/5 text-default whitespace-pre-wrap [overflow-wrap:anywhere]">{{ preview.text }}<span v-if="preview.hidden > 0" class="block pt-1 text-dimmed">… {{ preview.hidden === 1 ? '1 more line' : `${preview.hidden} more lines` }}</span></pre>
    <pre v-else-if="command" class="max-h-64 overflow-auto rounded-md bg-elevated p-3 text-xs/5 text-default whitespace-pre-wrap [overflow-wrap:anywhere]">{{ command }}</pre>
</template>
