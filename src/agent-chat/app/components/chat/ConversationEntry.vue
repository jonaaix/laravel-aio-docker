<script setup lang="ts">
defineProps<{
    title: string;
    creatorName: string | null;
    lastActivityAt: number;
    session: SessionState;
    paused: boolean;
    unread: boolean;
    now: number;
    wrapTitle?: boolean;
}>();

const { t } = useI18n();
</script>

<template>
    <span class="flex items-center gap-1.5">
        <span class="block" :class="[wrapTitle ? 'min-w-0 break-words' : 'truncate', unread ? 'font-semibold text-highlighted' : '', { 'light-streak text-muted!': session.live }]">{{ title }}</span>
        <span v-if="unread" class="size-2 shrink-0 rounded-full bg-primary" :aria-label="t('Unread')" />
    </span>
    <span class="mt-0.5 flex items-center gap-1.5 text-xs font-normal text-muted">
        <span class="flex min-w-0 items-center gap-1.5" :class="{ 'light-streak': session.live }">
            <template v-if="creatorName">
                <span class="min-w-0 truncate">{{ creatorName }}</span>
                <span aria-hidden="true">·</span>
            </template>
            <span class="shrink-0 tabular-nums">{{ formatRelativeTime(lastActivityAt, now) }}</span>
        </span>
        <ChatWorkingDots v-if="session.live" :label="t(session.label)" class="ms-auto" />
        <ChatSessionPill v-else-if="!paused" :state="session" class="ms-auto" />
    </span>
</template>
