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
        <figcaption v-if="(block.kind === 'variants' || block.kind === 'chart') && block.title" class="font-semibold text-highlighted">
            {{ block.title }}
        </figcaption>
        <ChatUiPage v-if="block.kind === 'page'" :page="block.page" :title="block.title" />
        <ChatUiCards v-if="block.kind === 'cards'" :sections="block.sections" />
        <ChatUiChart v-if="block.kind === 'chart'" :chart-type="block.chartType" :labels="block.labels" :series="block.series" :unit="block.unit" />
        <ChatUiVariants
            v-if="block.kind === 'variants'"
            :title="block.title"
            :options="block.options"
            :columns="block.columns"
            :viewport="block.viewport"
            :recommended="block.recommended"
            :multiple="block.multiple"
            :message-id="messageId"
        />
        <div v-if="block.kind === 'choice'" class="flex flex-col gap-2 rounded-md bg-elevated/60 px-4 py-3 dark:bg-elevated/40">
            <Markdown :value="block.question" :plugins="chatPlugins" class="font-medium text-highlighted *:my-0" />
            <ChatUiOptions :options="block.options" :recommended="block.recommended" :multiple="block.multiple" :message-id="messageId" />
        </div>
    </figure>
</template>
