<script setup lang="ts">
import type { UiBlock } from '#shared/types/ui-block';

defineProps<{
    block: UiBlock;
    messageId: string;
}>();

const chatPlugins = useChatMarkdownPlugins();
</script>

<template>
    <figure class="my-3 flex flex-col gap-2">
        <figcaption v-if="block.kind !== 'choice' && block.title" class="font-semibold text-highlighted">
            {{ block.title }}
        </figcaption>
        <ChatUiPage v-if="block.kind !== 'choice'" :page="block.page" :title="block.title" />
        <ChatUiOptions v-if="block.kind === 'variants'" :options="block.options" :recommended="block.recommended" :message-id="messageId" class="mt-1" />
        <div v-if="block.kind === 'choice'" class="flex flex-col gap-2 rounded-md bg-elevated/60 px-4 py-3 dark:bg-elevated/40">
            <Markdown :value="block.question" :plugins="chatPlugins" class="font-medium text-highlighted *:my-0" />
            <ChatUiOptions :options="block.options" :recommended="block.recommended" :message-id="messageId" />
        </div>
    </figure>
</template>
