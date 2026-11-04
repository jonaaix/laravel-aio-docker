<script setup lang="ts">
import type { ChatMessage } from '#shared/types/conversation';

const props = defineProps<{
    message: ChatMessage;
    streaming: boolean;
}>();

const changes = computed(() => turnFileChanges(props.message));
const list = ref<HTMLElement | null>(null);
const followsLatest = ref(true);

function stopFollowing(): void {
    followsLatest.value = false;
}

async function showLatest(): Promise<void> {
    const path = changes.value.recentPaths[0];
    if (!props.streaming || !followsLatest.value || !path) {
        return;
    }
    await nextTick();
    list.value?.querySelector(`[data-path="${CSS.escape(path)}"]`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

watch(() => props.message.id, async () => {
    followsLatest.value = true;
    await nextTick();
    list.value?.firstElementChild?.scrollIntoView({ block: 'start' });
});
watch(() => props.streaming, (streaming) => {
    if (streaming) {
        followsLatest.value = true;
    }
});
watch(() => changes.value.recentPaths.join('\n'), showLatest);
</script>

<template>
    <div ref="list" class="flex flex-col gap-4" @wheel.passive="stopFollowing" @touchmove.passive="stopFollowing">
        <div v-for="file in changes.files" :key="file.path" :data-path="file.path" class="scroll-mt-2">
            <ChatFileDiff :change="file" />
        </div>
    </div>
</template>
