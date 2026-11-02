<script setup lang="ts">
const ACCEPT_REPLY = 'ok';

const props = defineProps<{
    title: string;
    text: string;
    messageId: string;
    streaming: boolean;
}>();

const { messageId: answerableMessageId, answer } = useQuestionAnswers();

const active = computed(() => answerableMessageId.value === props.messageId);
</script>

<template>
    <ChatSectionCard :title="title">
        <Markdown :value="text" :plugins="markdownPlugins" :streaming="streaming" class="*:first:mt-0 *:last:mb-0" />
        <div v-if="active" class="mt-4 flex">
            <UButton
                label="Accept"
                icon="i-heroicons-check"
                color="neutral"
                variant="outline"
                class="bg-white dark:bg-transparent"
                @click="answer(ACCEPT_REPLY)"
            />
        </div>
    </ChatSectionCard>
</template>
