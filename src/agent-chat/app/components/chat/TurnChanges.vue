<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';

const props = defineProps<{
    message: ChatMessage;
    streaming: boolean;
    panelAvailable: boolean;
    shownInPanel: boolean;
}>();

const emit = defineEmits<{ show: [] }>();

const { t } = useI18n();

const changes = computed(() => turnFileChanges(props.message));
const files = computed(() => changes.value.files);
const title = computed(() => {
    const { added, removed } = changeTotals(files.value);
    return `${t('1 file changed | {count} files changed', { count: files.value.length }, files.value.length)} · +${added} −${removed}`;
});
</script>

<template>
    <template v-if="files.length > 0">
        <button
            v-if="panelAvailable"
            type="button"
            class="group flex h-7 max-w-full items-center gap-2 text-start text-sm"
            @click="emit('show')"
        >
            <UIcon name="i-heroicons-document-duplicate" class="size-4 shrink-0" :class="shownInPanel ? 'text-primary' : 'text-muted'" />
            <span class="font-medium" :class="shownInPanel ? 'text-primary' : 'text-default group-hover:text-primary'">{{ title }}</span>
            <UIcon name="i-heroicons-chevron-right" class="size-4 shrink-0 text-muted" />
        </button>
        <ChatActivityBox v-else :title="title" :active="false" :auto-open="streaming" icon="i-heroicons-document-duplicate" plain>
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
</template>
