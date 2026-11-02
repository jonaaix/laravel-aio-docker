import type { InjectionKey, Ref } from 'vue';

export interface QuestionAnswers {
    messageId: Ref<string | null>;
    chosen: Ref<Record<string, string>>;
    answer: (line: string) => void;
}

export const questionAnswersKey: InjectionKey<QuestionAnswers> = Symbol('questionAnswers');

export function useQuestionAnswers(): QuestionAnswers {
    return inject(questionAnswersKey, { messageId: ref(null), chosen: ref({}), answer: () => {} });
}
