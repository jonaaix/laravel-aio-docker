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
    <div class="rounded-md bg-linear-to-br from-(--ai-gradient-from)/12 via-(--ai-gradient-via)/8 to-(--ai-gradient-to)/12 border border-(--ai-gradient-via)/30 p-3">
        <div class="flex items-center gap-2 text-xs">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-(--ai-gradient-from) to-(--ai-gradient-via) text-white">
                <UIcon name="i-heroicons-check" class="size-4" />
            </span>
            <span class="font-semibold text-highlighted">{{ t('Committed') }}</span>
            <span class="ms-auto font-mono text-muted">{{ commit.hash.slice(0, 7) }}</span>
        </div>
        <p class="mt-2 text-sm font-medium text-highlighted [overflow-wrap:anywhere]">{{ commit.title }}</p>
        <p v-if="commit.body" class="mt-1 text-xs whitespace-pre-line text-toned [overflow-wrap:anywhere]">{{ shownBody }}</p>
        <button v-if="longBody" type="button" class="mt-1 text-xs font-medium text-muted hover:text-highlighted" @click="expanded = !expanded">
            {{ expanded ? t('Show less') : t('Show more') }}
        </button>
    </div>
</template>
