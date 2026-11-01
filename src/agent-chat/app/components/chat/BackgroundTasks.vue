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
    <ChatActivityBox :title="title" active :auto-open="false" icon="i-heroicons-arrow-path">
        <ul class="flex max-h-48 flex-col gap-2 overflow-y-auto pe-1">
            <li v-for="task in tasks" :key="task.id" class="flex flex-col gap-1">
                <div class="flex items-baseline gap-3 text-sm">
                    <span class="min-w-0 flex-1 text-default">{{ task.description }}</span>
                    <span class="shrink-0 text-muted tabular-nums">{{ formatElapsed(now - task.startedAt) }}</span>
                </div>
                <code v-if="task.command" class="truncate rounded-md bg-elevated px-2 py-1 font-mono text-xs text-default">{{ task.command }}</code>
            </li>
        </ul>
    </ChatActivityBox>
</template>
