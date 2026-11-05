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
    <div class="relative ps-6">
        <span class="absolute inset-y-0 start-[0.4375rem] w-0.5 rounded-full bg-(--ui-border-accented)" aria-hidden="true" />
        <span class="absolute start-0.5 top-1 size-3.5 rounded-full border-2 border-(--ai-gradient-via) bg-default" aria-hidden="true" />
        <div class="flex items-baseline gap-2">
            <p class="min-w-0 bg-linear-to-r from-(--ai-gradient-from) via-(--ai-gradient-via) to-(--ai-gradient-to) bg-clip-text text-sm font-semibold text-transparent [overflow-wrap:anywhere]">{{ commit.title }}</p>
            <span class="ms-auto shrink-0 font-mono text-xs text-muted">{{ commit.hash.slice(0, 7) }}</span>
        </div>
        <span class="sr-only">{{ t('Committed') }}</span>
        <p v-if="commit.body" class="mt-1 text-xs whitespace-pre-line text-toned [overflow-wrap:anywhere]">{{ shownBody }}</p>
        <button v-if="longBody" type="button" class="mt-1 text-xs font-medium text-muted hover:text-highlighted" @click="expanded = !expanded">
            {{ expanded ? t('Show less') : t('Show more') }}
        </button>
    </div>
</template>
