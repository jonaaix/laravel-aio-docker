import { parseQuestionSection, type QuestionSection } from './offered-questions';

const SECTION_BAR = /^\s*╌{3,}\s*$/;
const QUESTION_MARK = '❓';
const SUMMARY_MARK = '🔑';
const NEXT_MARK = '🚀';

export type TextSection =
    | { kind: 'text'; text: string }
    | { kind: 'section' | 'summary' | 'next'; title: string; text: string }
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
    if (title.includes(QUESTION_MARK)) {
        return { kind: 'questions', section: parseQuestionSection(title, lines) };
    }
    return { kind: sectionKind(title), title, text };
}

function sectionKind(title: string): 'section' | 'summary' | 'next' {
    if (title.includes(SUMMARY_MARK)) {
        return 'summary';
    }
    return title.includes(NEXT_MARK) ? 'next' : 'section';
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
