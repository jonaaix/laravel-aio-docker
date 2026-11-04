<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';

const props = defineProps<{
    message: ChatMessage;
}>();

const { t } = useI18n();

const files = computed(() => turnFileChanges(props.message));
const title = computed(() => {
    const added = files.value.reduce((sum, file) => sum + file.added, 0);
    const removed = files.value.reduce((sum, file) => sum + file.removed, 0);
    return `${t('1 file changed | {count} files changed', { count: files.value.length }, files.value.length)} · +${added} −${removed}`;
});
</script>

<template>
    <ChatActivityBox v-if="files.length > 0" :title="title" :active="false" :auto-open="false" icon="i-heroicons-document-duplicate">
        <div class="flex flex-col gap-1.5">
            <ChatFileDiff v-for="file in files" :key="file.path" :change="file" collapsible />
        </div>
    </ChatActivityBox>
</template>
