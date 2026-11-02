<script setup lang="ts">
import type { OfferedOption, OfferedQuestion, QuestionSection } from '~/utils/offered-questions';

const props = defineProps<{
    section: QuestionSection;
    messageId: string;
}>();

const { messageId: answerableMessageId, chosen, sent, answer } = useQuestionAnswers();

const active = computed(() => answerableMessageId.value === props.messageId);
const sentAnswer = computed(() => active.value ? undefined : sent(props.messageId));
const expanded = ref(false);
const collapsed = computed(() => sentAnswer.value !== undefined && !expanded.value);
const unanswered = computed(() => sentAnswer.value !== undefined && props.section.questions.every(question => !sentLetter(question)));

function sentLetter(question: OfferedQuestion): string | undefined {
    const answer = sentAnswer.value;
    if (!answer) {
        return undefined;
    }
    return answer.chosen[question.number] ?? (answer.accepted ? question.options.find(option => option.recommended)?.letter : undefined);
}

function shownOptions(question: OfferedQuestion): OfferedOption[] {
    return collapsed.value ? question.options.filter(option => option.letter === sentLetter(question)) : question.options;
}

const recommendable = computed(() => props.section.questions.filter(question => question.options.some(option => option.recommended)));

function publish(selection: Record<string, string>): void {
    answer(props.section.questions
        .filter(question => selection[question.number])
        .map(question => `${question.number} ${selection[question.number]}`)
        .join(', '));
}

function pick(question: OfferedQuestion, letter: string): void {
    const { [question.number]: current, ...others } = chosen.value;
    publish(current === letter ? others : { ...others, [question.number]: letter });
}

function acceptRecommendations(): void {
    publish(Object.fromEntries(recommendable.value.map(question => [
        question.number,
        question.options.find(option => option.recommended)!.letter,
    ])));
}

function isSelected(question: OfferedQuestion, letter: string): boolean {
    return active.value ? chosen.value[question.number] === letter : sentLetter(question) === letter;
}
</script>

<template>
    <ChatSectionCard :title="section.title">
        <div class="flex flex-col" :class="collapsed ? 'gap-3' : 'gap-5'">
            <Markdown v-if="section.intro && !collapsed" :value="section.intro" :plugins="markdownPlugins" class="*:first:mt-0 *:last:mb-0" />
            <div
                v-for="question in section.questions"
                :key="question.number"
                class="grid grid-cols-[minmax(1.75rem,auto)_minmax(0,1fr)] gap-x-1 gap-y-1"
            >
                <span class="font-medium whitespace-nowrap text-highlighted tabular-nums">{{ question.number }}.</span>
                <Markdown :value="question.text" :plugins="markdownPlugins" class="font-medium text-highlighted *:my-0" />
                <Markdown
                    v-if="question.hint && !collapsed"
                    :value="question.hint"
                    :plugins="markdownPlugins"
                    class="col-start-2 text-muted *:my-0"
                />
                <div v-if="shownOptions(question).length > 0" class="col-start-2 -mx-2 flex flex-col">
                    <button
                        v-for="option in shownOptions(question)"
                        :key="option.letter"
                        type="button"
                        :disabled="!active"
                        :aria-pressed="isSelected(question, option.letter)"
                        class="flex w-full items-start gap-2 rounded-sm px-2 py-0.5 text-start transition-colors duration-500 ease-out disabled:cursor-default"
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
            <p v-if="collapsed && unanswered" class="text-sm text-muted">Not answered</p>
            <Markdown v-if="section.outro && !collapsed" :value="section.outro" :plugins="markdownPlugins" class="*:first:mt-0 *:last:mb-0" />
            <UButton
                v-if="sentAnswer !== undefined"
                :label="expanded ? 'Show less' : 'Show all options'"
                :trailing-icon="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                color="neutral"
                variant="link"
                size="sm"
                class="-mt-2 self-start px-0"
                @click="expanded = !expanded"
            />
            <div v-if="active && recommendable.length > 1" class="flex">
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
    </ChatSectionCard>
</template>
