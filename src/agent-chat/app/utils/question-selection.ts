import type { OfferedQuestion, QuestionSection } from './offered-questions';

export type Selection = Record<string, string>;

function recommendedLetter(question: OfferedQuestion): string | undefined {
    return question.options.find(option => option.recommended)?.letter;
}

export function withPick(chosen: Selection, question: OfferedQuestion, letter: string): Selection {
    const { [question.number]: current, ...others } = chosen;
    return current === letter ? others : { ...others, [question.number]: letter };
}

export function recommendableQuestions(section: QuestionSection): OfferedQuestion[] {
    return section.questions.filter(question => recommendedLetter(question) !== undefined);
}

export function withRecommendations(chosen: Selection, section: QuestionSection): Selection {
    const own = new Set(section.questions.map(question => question.number));
    const kept = Object.fromEntries(Object.entries(chosen).filter(([number]) => !own.has(number)));
    const recommended = recommendableQuestions(section).map(question => [question.number, recommendedLetter(question)!]);
    return { ...kept, ...Object.fromEntries(recommended) };
}
