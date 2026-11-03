<script setup lang="ts">
const props = defineProps<{
    title: string;
    text: string;
    messageId: string;
    streaming: boolean;
}>();

const { t } = useI18n();
const { messageId: answerableMessageId, accept } = useQuestionAnswers();

const active = computed(() => answerableMessageId.value === props.messageId);

const chatPlugins = useChatMarkdownPlugins();
</script>

<template>
    <ChatSectionCard :title="title">
        <Markdown :value="text" :plugins="chatPlugins" :streaming="streaming" class="*:first:mt-0 *:last:mb-0" />
        <div v-if="active" class="mt-4 flex">
            <UButton
                :label="t('Accept')"
                icon="i-heroicons-check"
                color="neutral"
                variant="outline"
                class="bg-white dark:bg-transparent"
                @click="accept"
            />
        </div>
    </ChatSectionCard>
</template>
