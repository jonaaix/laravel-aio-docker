<script setup lang="ts">
import type { OfferedOption, OfferedQuestion, QuestionSection } from '~/utils/offered-questions';
import { recommendableQuestions, withPick, withRecommendations } from '~/utils/question-selection';

const props = defineProps<{
    section: QuestionSection;
    messageId: string;
}>();

const { t } = useI18n();
const { messageId: answerableMessageId, chosen, sent, choose } = useQuestionAnswers();

const active = computed(() => answerableMessageId.value === props.messageId);
const sentAnswer = computed(() => active.value ? undefined : sent(props.messageId));
const expanded = ref(false);
const collapsed = computed(() => sentAnswer.value !== undefined && !expanded.value);
const unanswered = computed(() => sentAnswer.value !== undefined && props.section.questions.every(question => !sentLetter(question)));

function sentLetter(question: OfferedQuestion): string | undefined {
    const reply = sentAnswer.value;
    if (!reply) {
        return undefined;
    }
    return reply.chosen[question.number] ?? (reply.accepted ? question.options.find(option => option.recommended)?.letter : undefined);
}

function shownOptions(question: OfferedQuestion): OfferedOption[] {
    return collapsed.value ? question.options.filter(option => option.letter === sentLetter(question)) : question.options;
}

const recommendable = computed(() => recommendableQuestions(props.section));

function pick(question: OfferedQuestion, letter: string): void {
    choose(withPick(chosen.value, question, letter));
}

function acceptRecommendations(): void {
    choose(withRecommendations(chosen.value, props.section));
}

function isSelected(question: OfferedQuestion, letter: string): boolean {
    return active.value ? chosen.value[question.number] === letter : sentLetter(question) === letter;
}

const chatPlugins = useChatMarkdownPlugins();
</script>

<template>
    <ChatSectionCard :title="section.title">
        <div class="flex flex-col" :class="collapsed ? 'gap-2.5' : 'gap-4'">
            <Markdown v-if="section.intro && !collapsed" :value="section.intro" :plugins="chatPlugins" class="*:first:mt-0 *:last:mb-0" />
            <div
                v-for="question in section.questions"
                :key="question.number"
                class="grid grid-cols-[minmax(1.75rem,auto)_minmax(0,1fr)] gap-x-1 gap-y-1 text-[calc(var(--text-base)-1px)]"
            >
                <span class="font-medium whitespace-nowrap text-highlighted tabular-nums">{{ question.number }}.</span>
                <Markdown :value="question.text" :plugins="chatPlugins" class="font-medium text-highlighted *:my-0" />
                <Markdown
                    v-if="question.hint && !collapsed"
                    :value="question.hint"
                    :plugins="chatPlugins"
                    class="col-start-2 text-muted *:my-0"
                />
                <div v-if="shownOptions(question).length > 0" class="col-start-2 -mx-2 flex flex-col">
                    <ChatOptionRow
                        v-for="option in shownOptions(question)"
                        :key="option.letter"
                        :letter="option.letter"
                        :selected="isSelected(question, option.letter)"
                        :disabled="!active"
                        @pick="pick(question, option.letter)"
                    >
                        <Markdown :value="option.text" :plugins="chatPlugins" class="*:my-0" />
                    </ChatOptionRow>
                </div>
            </div>
            <p v-if="collapsed && unanswered" class="text-sm text-muted">{{ t('Not answered') }}</p>
            <Markdown v-if="section.outro && !collapsed" :value="section.outro" :plugins="chatPlugins" class="*:first:mt-0 *:last:mb-0" />
            <UButton
                v-if="sentAnswer !== undefined"
                :label="expanded ? t('Show less') : t('Show all options')"
                :trailing-icon="expanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
                color="neutral"
                variant="link"
                size="sm"
                class="-mt-2 self-start px-0"
                @click="expanded = !expanded"
            />
            <div v-if="active && recommendable.length > 1" class="flex">
                <UButton
                    :label="t('Accept recommendations')"
                    icon="i-heroicons-star"
                    color="primary"
                    variant="subtle"
                    @click="acceptRecommendations"
                />
            </div>
        </div>
    </ChatSectionCard>
</template>
