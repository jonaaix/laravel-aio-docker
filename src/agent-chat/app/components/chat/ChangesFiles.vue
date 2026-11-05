<script setup lang="ts">
import type { ChatMessage, FileChange, TurnCommit } from '#shared/types/conversation';

type ChangeEntry = { key: string; file: FileChange; commit?: never; order: number } | { key: string; commit: TurnCommit; file?: never; order: number };

const props = defineProps<{
    message: ChatMessage;
    live: boolean;
}>();

const entries = computed<ChangeEntry[]>(() => {
    const { files, commits } = turnFileChanges(props.message);
    return [
        ...files.map((file, index) => ({ key: `file:${file.path}`, file, order: file.order ?? index })),
        ...(commits ?? []).map(commit => ({ key: `commit:${commit.hash}`, commit, order: commit.order })),
    ].sort((a, b) => a.order - b.order);
});
</script>

<template>
    <TransitionGroup
        :key="message.id"
        :appear="live"
        tag="div"
        class="flex flex-col"
        enter-active-class="transition-[grid-template-rows,opacity] duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]"
        enter-from-class="[--rows:0fr] opacity-0"
        leave-active-class="transition-[grid-template-rows,opacity] duration-200 ease-in"
        leave-to-class="[--rows:0fr] opacity-0"
        move-class="transition-transform duration-350 ease-[cubic-bezier(0.22,1,0.36,1)]"
    >
        <div v-for="(entry, index) in entries" :key="entry.key" class="grid grid-rows-[var(--rows,1fr)]">
            <div class="min-h-0 overflow-hidden" :class="index > 0 ? 'pt-4' : ''">
                <ChatCommitCard v-if="entry.commit" :commit="entry.commit" />
                <ChatFileDiff v-else :change="entry.file" />
            </div>
        </div>
    </TransitionGroup>
</template>
