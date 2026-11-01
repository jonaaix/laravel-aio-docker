<script setup lang="ts">
import type { OfferedQuestion } from '~/utils/offered-questions';

const props = defineProps<{
    questions: OfferedQuestion[];
}>();

const emit = defineEmits<{ change: [answers: string] }>();

const selected = ref<Record<string, string>>({});
const recommendable = computed(() => props.questions.filter(question => question.options.some(option => option.recommended)));

function publish(): void {
    emit('change', props.questions
        .filter(question => selected.value[question.number])
        .map(question => `${question.number} ${selected.value[question.number]}`)
        .join(', '));
}

function pick(question: OfferedQuestion, letter: string): void {
    const { [question.number]: current, ...others } = selected.value;
    selected.value = current === letter ? others : { ...others, [question.number]: letter };
    publish();
}

function acceptRecommendations(): void {
    selected.value = Object.fromEntries(recommendable.value.map(question => [
        question.number,
        question.options.find(option => option.recommended)!.letter,
    ]));
    publish();
}
</script>

<template>
    <div class="mt-4 flex flex-col gap-2">
        <div v-for="question in questions" :key="question.number" class="flex flex-wrap items-center gap-2">
            <span class="w-8 text-sm text-muted tabular-nums">{{ question.number }}</span>
            <UButton
                v-for="option in question.options"
                :key="option.letter"
                :label="option.letter"
                :icon="option.recommended ? 'i-heroicons-star' : undefined"
                :aria-label="`${question.number} ${option.letter}: ${option.text}`"
                :aria-pressed="selected[question.number] === option.letter"
                color="neutral"
                :variant="selected[question.number] === option.letter ? 'solid' : 'outline'"
                :class="['min-w-9 justify-center', selected[question.number] === option.letter ? '' : 'bg-white dark:bg-transparent']"
                @click="pick(question, option.letter)"
            />
        </div>
        <div v-if="recommendable.length > 1" class="flex">
            <UButton
                label="Accept recommendations"
                icon="i-heroicons-star"
                color="neutral"
                variant="outline"
                class="bg-white dark:bg-transparent"
                @click="acceptRecommendations"
            />
        </div>
    </div>
</template>
