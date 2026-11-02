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
    outro: string;
}

function joinLine(existing: string, line: string): string {
    return existing ? `${existing}\n${line}` : line;
}

export function parseQuestionSection(title: string, lines: string[]): QuestionSection {
    const section: QuestionSection = { title, intro: '', questions: [], outro: '' };
    let afterBlank = false;
    for (const line of lines) {
        const trimmed = line.trim();
        const current = section.questions.at(-1);
        const lastOption = current?.options.at(-1);
        const question = QUESTION_LINE.exec(line);
        const option = current ? OPTION_LINE.exec(line) : null;
        if (question) {
            section.questions.push({ number: question[1]!, text: question[2]!.trim(), hint: '', options: [] });
        }
        else if (option && current) {
            const text = option[2]!.trim();
            current.options.push({ letter: option[1]!, text, recommended: text.includes(RECOMMENDED_MARK) });
        }
        else if (lastOption && trimmed && !afterBlank && !section.outro) {
            lastOption.text = `${lastOption.text} ${trimmed}`;
        }
        else if (lastOption && trimmed) {
            section.outro = joinLine(section.outro, trimmed);
        }
        else if (current && trimmed) {
            current.hint = joinLine(current.hint, trimmed);
        }
        else if (trimmed) {
            section.intro = joinLine(section.intro, trimmed);
        }
        afterBlank = !trimmed;
    }
    return section;
}
