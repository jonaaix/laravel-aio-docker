<script setup lang="ts">
import { CollapsibleContent, CollapsibleRoot } from 'reka-ui';
import type { FileChange } from '#shared/types/conversation';
import type { FilePreview } from '~/utils/file-kind';

const props = withDefaults(defineProps<{
    change: FileChange;
    collapsible?: boolean;
    expanded?: boolean;
    fullHeight?: boolean;
}>(), { collapsible: false, expanded: false, fullHeight: false });

const { t } = useI18n();
const route = useRoute();

const open = ref(!props.collapsible || props.expanded);
watch(() => props.expanded, (expanded) => {
    open.value = expanded;
});
const previewOpen = ref(false);
const preview = computed<FilePreview | null>(() => {
    if (props.change.status === 'deleted' || props.change.binary) {
        return null;
    }
    return textFilePreview(props.change.path);
});
const fileName = computed(() => props.change.path.split('/').at(-1) ?? props.change.path);
const fileUrl = computed(() => {
    const base = apiUrl(`conversations/${route.params.id}/project-file`);
    return `${base}${base.includes('?') ? '&' : '?'}path=${encodeURIComponent(props.change.path)}`;
});

const lines = computed(() => unifiedDiffLines(props.change.lines));
const changedLines = computed(() => lines.value.flatMap(line => line.kind === 'added' && line.number ? [line.number] : []));

const statusLabel = computed(() => {
    if (props.change.status === 'added') {
        return t('New');
    }
    if (props.change.status === 'deleted') {
        return t('Deleted');
    }
    return props.change.status === 'renamed' ? t('Renamed') : '';
});
</script>

<template>
    <CollapsibleRoot :open="open" class="flex flex-col">
        <div class="flex min-h-7 items-center gap-2 text-xs">
            <UIcon name="i-heroicons-document-text" class="size-4 shrink-0 text-muted" />
            <button
                v-if="preview"
                type="button"
                class="min-w-0 text-start font-mono text-default underline-offset-2 [overflow-wrap:anywhere] hover:text-primary hover:underline"
                @click="previewOpen = true"
            >
                {{ change.path }}
            </button>
            <span v-else class="min-w-0 font-mono text-default [overflow-wrap:anywhere]">{{ change.path }}</span>
            <component
                :is="collapsible ? 'button' : 'div'"
                :type="collapsible ? 'button' : undefined"
                :aria-label="collapsible ? (open ? t('Hide changes') : t('Show changes')) : undefined"
                class="flex flex-1 items-center gap-2 self-stretch text-start"
                @click="collapsible && (open = !open)"
            >
                <UBadge v-if="statusLabel" :label="statusLabel" color="neutral" variant="subtle" size="sm" />
                <span class="shrink-0 tabular-nums text-success">+{{ change.added }}</span>
                <span class="shrink-0 tabular-nums text-error">−{{ change.removed }}</span>
                <UIcon
                    v-if="collapsible"
                    name="i-heroicons-chevron-down"
                    class="size-4 shrink-0 text-muted transition-transform duration-200"
                    :class="open ? 'rotate-180' : ''"
                />
            </component>
        </div>
        <CollapsibleContent class="data-[state=closed]:animate-[collapsible-up_200ms_var(--ease-out)] data-[state=open]:animate-[collapsible-down_200ms_var(--ease-out)] data-[state=closed]:overflow-hidden">
            <div class="flex flex-col gap-1 pt-1 pb-1.5">
                <p v-if="change.binary" class="text-xs text-muted">{{ t('Binary file') }}</p>
                <ChatDiffLines v-else-if="lines.length > 0" :lines="lines" :language="fileLanguage(change.path)" :class="fullHeight ? '' : 'max-h-96'" />
                <p v-if="change.truncated" class="text-xs text-muted">{{ t('Diff shortened') }}</p>
            </div>
        </CollapsibleContent>
        <ChatFilePreview
            v-if="preview"
            v-model:open="previewOpen"
            :url="fileUrl"
            :filename="fileName"
            :details="change.path"
            :preview="preview"
            :size="null"
            :changed-lines="changedLines"
        />
    </CollapsibleRoot>
</template>
