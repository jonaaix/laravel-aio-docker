const QUESTION_LINE = /^\s*(?:\*\*)?(\d+)[.)](?:\*\*)?\s+\S/;
const OPTION_LINE = /^\s*(?:[-*]\s+)?([a-z])\)\s+(.+)$/;
const RECOMMENDED_MARK = '⭐';

export interface OfferedOption {
    letter: string;
    text: string;
    recommended: boolean;
}

export interface OfferedQuestion {
    number: string;
    options: OfferedOption[];
}

function optionsBelow(lines: string[], start: number): OfferedOption[] {
    const options: OfferedOption[] = [];
    for (const line of lines.slice(start)) {
        const match = OPTION_LINE.exec(line);
        const expected = String.fromCharCode('a'.charCodeAt(0) + options.length);
        if (!match || match[1] !== expected) {
            break;
        }
        options.push({ letter: expected, text: match[2]!.trim(), recommended: match[2]!.includes(RECOMMENDED_MARK) });
    }
    return options;
}

export function offeredQuestions(text: string): OfferedQuestion[] {
    const lines = text.split('\n');
    return lines.flatMap((line, index) => {
        const match = QUESTION_LINE.exec(line);
        const options = match ? optionsBelow(lines, index + 1) : [];
        return options.length >= 2 ? [{ number: match![1]!, options }] : [];
    });
}
