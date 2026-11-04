<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';

const props = defineProps<{
    message: ChatMessage;
    streaming: boolean;
}>();

const { t } = useI18n();

const changes = computed(() => turnFileChanges(props.message));
const files = computed(() => changes.value.files);
const title = computed(() => {
    const added = files.value.reduce((sum, file) => sum + file.added, 0);
    const removed = files.value.reduce((sum, file) => sum + file.removed, 0);
    return `${t('1 file changed | {count} files changed', { count: files.value.length }, files.value.length)} · +${added} −${removed}`;
});
</script>

<template>
    <ChatActivityBox v-if="files.length > 0" :title="title" :active="false" :auto-open="streaming" icon="i-heroicons-document-duplicate" plain>
        <div class="flex flex-col gap-1.5">
            <ChatFileDiff
                v-for="file in files"
                :key="file.path"
                :change="file"
                :expanded="streaming && changes.recentPaths.includes(file.path)"
                collapsible
            />
        </div>
    </ChatActivityBox>
</template>
