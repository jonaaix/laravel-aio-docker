import type { InjectionKey, Ref } from 'vue';
import type { AnswerLine } from '~/utils/answer-line';

export interface QuestionAnswers {
    messageId: Ref<string | null>;
    chosen: Ref<Record<string, string>>;
    sent: (messageId: string) => AnswerLine | undefined;
    choose: (selection: Record<string, string>) => void;
    accept: () => void;
    acceptChoice: (selection: Record<string, string>) => void;
}

export const questionAnswersKey: InjectionKey<QuestionAnswers> = Symbol('questionAnswers');

export function useQuestionAnswers(): QuestionAnswers {
    return inject(questionAnswersKey, { messageId: ref(null), chosen: ref({}), sent: () => undefined, choose: () => {}, accept: () => {}, acceptChoice: () => {} });
}
