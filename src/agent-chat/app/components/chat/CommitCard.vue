<script setup lang="ts">
import type { TurnCommit } from '#shared/types/conversation';

const props = defineProps<{ commit: TurnCommit }>();

const PREVIEW_LINES = 3;

const { t } = useI18n();
const expanded = ref(false);

const bodyLines = computed(() => props.commit.body.split('\n'));
const longBody = computed(() => bodyLines.value.length > PREVIEW_LINES);
const shownBody = computed(() => expanded.value || !longBody.value ? props.commit.body : bodyLines.value.slice(0, PREVIEW_LINES).join('\n'));
</script>

<template>
    <div class="flex flex-col gap-1">
        <div class="flex min-h-7 items-center gap-2 text-xs">
            <UIcon name="i-heroicons-check-circle" class="size-4 shrink-0 text-muted" />
            <span class="text-default">{{ t('Git commit') }}</span>
            <ChatCopyButton :text="commit.hash" :label="commit.hash.slice(0, 7)" class="-ms-1.5" />
        </div>
        <div class="rounded-md bg-linear-to-r from-(--ai-gradient-from) via-(--ai-gradient-via) to-(--ai-gradient-to) p-px">
            <div class="relative rounded-[calc(var(--radius-md)-1px)] bg-default py-2.5 ps-9 pe-3">
                <span v-if="commit.body" class="absolute start-[1.1875rem] top-6 bottom-3 w-0.5 rounded-full bg-(--ui-border-accented)" aria-hidden="true" />
                <span class="absolute start-3 top-3 size-3.5 rounded-full border-2 border-(--ai-gradient-via) bg-default" aria-hidden="true" />
                <div class="flex items-baseline gap-3">
                    <p class="min-w-0 flex-1 bg-linear-to-r from-(--ai-gradient-from) via-(--ai-gradient-via) to-(--ai-gradient-to) bg-clip-text text-sm font-semibold text-transparent [overflow-wrap:anywhere]">{{ commit.title }}</p>
                    <span v-if="commit.files" class="flex shrink-0 gap-1.5 text-xs text-muted tabular-nums">
                        {{ t('1 file changed | {count} files changed', commit.files) }}
                        <span class="text-success">+{{ commit.added }}</span>
                        <span class="text-error">−{{ commit.removed }}</span>
                    </span>
                </div>
                <p v-if="commit.body" class="mt-1 text-xs whitespace-pre-line text-toned [overflow-wrap:anywhere]">{{ shownBody }}</p>
                <button v-if="longBody" type="button" class="mt-1 text-xs font-medium text-muted hover:text-highlighted" @click="expanded = !expanded">
                    {{ expanded ? t('Show less') : t('Show more') }}
                </button>
            </div>
        </div>
    </div>
</template>
