<script setup lang="ts">
import type { BackgroundTask } from '#shared/types/conversation';

const TICK_MS = 1000;

const props = defineProps<{
    tasks: BackgroundTask[];
}>();

const title = computed(() => props.tasks.length === 1 ? '1 background task running' : `${props.tasks.length} background tasks running`);

const now = ref(Date.now());
let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
    timer = setInterval(() => {
        now.value = Date.now();
    }, TICK_MS);
});

onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
    <ChatActivityBox :title="title" active always-open :auto-open="true" icon="i-heroicons-arrow-path">
        <ul class="flex max-h-48 flex-col gap-1 overflow-y-auto pe-1">
            <li v-for="task in tasks" :key="task.id" class="flex items-baseline gap-3 text-sm">
                <span class="min-w-0 flex-1 text-default">{{ task.description }}</span>
                <span class="shrink-0 text-muted tabular-nums">{{ formatElapsed(now - task.startedAt) }}</span>
            </li>
        </ul>
    </ChatActivityBox>
</template>
