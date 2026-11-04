<script setup lang="ts">
import type { FileChange } from '#shared/types/conversation';

const PREVIEW_LINES = 12;

const props = withDefaults(defineProps<{
    change: FileChange;
    collapsible?: boolean;
}>(), { collapsible: false });

const { t } = useI18n();
const route = useRoute();

const open = ref(!props.collapsible);
const previewOpen = ref(false);
const preview = computed(() => props.change.status === 'deleted' ? null : filePreview(props.change.path));
const fileName = computed(() => props.change.path.split('/').at(-1) ?? props.change.path);
const fileUrl = computed(() => {
    const base = apiUrl(`conversations/${route.params.id}/project-file`);
    return `${base}${base.includes('?') ? '&' : '?'}path=${encodeURIComponent(props.change.path)}`;
});
const expanded = ref(false);

const lines = computed(() => unifiedDiffLines(props.change.lines));
const hiddenCount = computed(() => Math.max(0, lines.value.length - PREVIEW_LINES));
const shownLines = computed(() => expanded.value ? lines.value : lines.value.slice(0, PREVIEW_LINES));

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
    <div class="flex flex-col gap-1">
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
        <template v-if="open">
            <p v-if="change.binary" class="text-xs text-muted">{{ t('Binary file') }}</p>
            <template v-else-if="lines.length > 0">
                <ChatDiffLines :lines="shownLines" :language="fileLanguage(change.path)" :class="expanded ? 'max-h-96' : ''" />
                <UButton
                    v-if="hiddenCount > 0"
                    :label="expanded ? t('Show less') : t('Show 1 more line | Show {count} more lines', { count: hiddenCount }, hiddenCount)"
                    :trailing-icon="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                    color="neutral"
                    variant="link"
                    size="xs"
                    class="self-start px-0"
                    @click="expanded = !expanded"
                />
            </template>
            <p v-if="change.truncated" class="text-xs text-muted">{{ t('Diff shortened') }}</p>
        </template>
        <ChatFilePreview
            v-if="preview"
            v-model:open="previewOpen"
            :url="fileUrl"
            :filename="fileName"
            :details="change.path"
            :preview="preview"
            :size="null"
        />
    </div>
</template>
