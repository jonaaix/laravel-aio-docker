const QUESTION_LINE = /^\s*(?:\*\*)?(\d+)[.)](?:\*\*)?\s+(.+)$/;
const OPTION_LINE = /^\s*(?:[-*]\s+)?([a-z])\)\s+(.+)$/;
const RECOMMENDED_MARK = '⭐';

export interface OfferedOption {
    letter: string;
    text: string;
    recommended: boolean;
}

export interface OfferedQuestion {
    number: string;
    text: string;
    hint: string;
    options: OfferedOption[];
}

export interface QuestionSection {
    title: string;
    intro: string;
    questions: OfferedQuestion[];
}

function joinLine(existing: string, line: string): string {
    return existing ? `${existing}\n${line}` : line;
}

export function parseQuestionSection(title: string, lines: string[]): QuestionSection {
    const section: QuestionSection = { title, intro: '', questions: [] };
    for (const line of lines) {
        const current = section.questions.at(-1);
        const question = QUESTION_LINE.exec(line);
        const option = current ? OPTION_LINE.exec(line) : null;
        if (question) {
            section.questions.push({ number: question[1]!, text: question[2]!.trim(), hint: '', options: [] });
        }
        else if (option && current) {
            const text = option[2]!.trim();
            current.options.push({ letter: option[1]!, text, recommended: text.includes(RECOMMENDED_MARK) });
        }
        else if (current && line.trim()) {
            current.hint = joinLine(current.hint, line.trim());
        }
        else if (line.trim()) {
            section.intro = joinLine(section.intro, line.trim());
        }
    }
    return section;
}
