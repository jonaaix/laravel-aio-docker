import { parseQuestionSection, type QuestionSection } from './offered-questions';

const SECTION_BAR = /^\s*╌{3,}\s*$/;
const QUESTION_MARK = '❓';

export type TextSection =
    | { kind: 'text'; text: string }
    | { kind: 'section'; title: string; text: string }
    | { kind: 'questions'; section: QuestionSection };

function opensSection(lines: string[], index: number): boolean {
    return SECTION_BAR.test(lines[index] ?? '')
        && (lines[index + 1] ?? '').trim() !== ''
        && !SECTION_BAR.test(lines[index + 1] ?? '')
        && SECTION_BAR.test(lines[index + 2] ?? '');
}

function toSection(title: string | null, lines: string[]): TextSection | null {
    const text = lines.join('\n');
    if (title === null) {
        return text.trim() ? { kind: 'text', text } : null;
    }
    return title.includes(QUESTION_MARK)
        ? { kind: 'questions', section: parseQuestionSection(title, lines) }
        : { kind: 'section', title, text };
}

export function splitTextSections(text: string): TextSection[] {
    const lines = text.split('\n');
    const sections: TextSection[] = [];
    let title: string | null = null;
    let buffer: string[] = [];
    const flush = (): void => {
        const section = toSection(title, buffer);
        if (section) {
            sections.push(section);
        }
        buffer = [];
    };
    for (let index = 0; index < lines.length; index++) {
        if (opensSection(lines, index)) {
            flush();
            title = lines[index + 1]!.trim();
            index += 2;
        }
        else if (SECTION_BAR.test(lines[index]!)) {
            flush();
            title = null;
        }
        else {
            buffer.push(lines[index]!);
        }
    }
    flush();
    return sections;
}
