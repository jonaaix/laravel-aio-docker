<script setup lang="ts">
import type { OfferedQuestion, QuestionSection } from '~/utils/offered-questions';

const props = defineProps<{
    section: QuestionSection;
    messageId: string;
}>();

const { messageId: answerableMessageId, answer } = useQuestionAnswers();

const active = computed(() => answerableMessageId.value === props.messageId);
const selected = ref<Record<string, string>>({});
const recommendable = computed(() => props.section.questions.filter(question => question.options.some(option => option.recommended)));

function publish(): void {
    answer(props.section.questions
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

function isSelected(question: OfferedQuestion, letter: string): boolean {
    return selected.value[question.number] === letter;
}
</script>

<template>
    <div class="my-4 rounded-xl bg-white ring ring-default dark:bg-elevated/40">
        <div class="flex h-11 items-center border-b border-default px-3 font-semibold text-highlighted">
            <ChatSectionTitle :title="section.title" />
        </div>
        <div class="flex flex-col gap-5 p-4">
            <Markdown v-if="section.intro" :value="section.intro" :plugins="markdownPlugins" class="*:first:mt-0 *:last:mb-0" />
            <div
                v-for="question in section.questions"
                :key="question.number"
                class="grid grid-cols-[minmax(1.75rem,auto)_minmax(0,1fr)] gap-x-1 gap-y-1"
            >
                <span class="font-medium whitespace-nowrap text-highlighted tabular-nums">{{ question.number }}.</span>
                <Markdown :value="question.text" :plugins="markdownPlugins" class="font-medium text-highlighted *:my-0" />
                <Markdown
                    v-if="question.hint"
                    :value="question.hint"
                    :plugins="markdownPlugins"
                    class="col-start-2 text-muted *:my-0"
                />
                <div v-if="question.options.length > 0" class="col-start-2 -mx-2 flex flex-col">
                    <button
                        v-for="option in question.options"
                        :key="option.letter"
                        type="button"
                        :disabled="!active"
                        :aria-pressed="isSelected(question, option.letter)"
                        class="flex w-full items-start gap-2 rounded-lg px-2 py-0.5 text-start transition-colors duration-500 ease-out disabled:cursor-default"
                        :class="isSelected(question, option.letter)
                            ? 'bg-accented/50 text-highlighted'
                            : 'text-default enabled:hover:bg-elevated/60'"
                        @click="pick(question, option.letter)"
                    >
                        <span class="shrink-0" :class="isSelected(question, option.letter) ? '' : 'text-muted'">{{ option.letter }})</span>
                        <Markdown :value="option.text" :plugins="markdownPlugins" class="min-w-0 flex-1 *:my-0" />
                        <UIcon
                            v-if="isSelected(question, option.letter)"
                            name="i-heroicons-check"
                            class="mt-1 size-4 shrink-0"
                        />
                    </button>
                </div>
            </div>
            <div v-if="active && recommendable.length > 1" class="flex justify-end">
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
    </div>
</template>
