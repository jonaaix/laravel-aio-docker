const ANSWER_SEPARATOR = /,|&|\b(?:und|and)\b/i;
const ANSWER_TOKEN = /^(?:ok|\d+[\s:.)]*[a-z](?:\s+\d+[\s:.)]*[a-z])*)$/i;
const ACCEPT_TOKEN = /^ok$/i;
const PENDING_NUMBER = /^\d+$/;
const CHOSEN_OPTION = /(\d+)[\s:.)]*([a-z])\b/gi;
const ANNOTATED_ANSWER = /^\s*(\d+)[\s:.)]*([a-z])(?=$|[^a-z0-9])(.*)$/i;

export interface AnswerLine {
    accepted: boolean;
    chosen: Record<string, string>;
}

export interface AnswerBlock extends AnswerLine {
    lineCount: number;
    comments: Record<string, string>;
}

export function readAnswerLine(line: string): AnswerLine | null {
    const tokens = line.split(ANSWER_SEPARATOR).map(token => token.trim()).filter(Boolean);
    const complete = PENDING_NUMBER.test(tokens.at(-1) ?? '') ? tokens.slice(0, -1) : tokens;
    if (complete.length === 0 || !complete.every(token => ANSWER_TOKEN.test(token))) {
        return null;
    }
    return {
        accepted: complete.some(token => ACCEPT_TOKEN.test(token)),
        chosen: Object.fromEntries([...line.matchAll(CHOSEN_OPTION)].map(([, number, letter]) => [number!, letter!.toLowerCase()])),
    };
}

export function readAnswerBlock(text: string): AnswerBlock {
    const block: AnswerBlock = { accepted: false, chosen: {}, comments: {}, lineCount: 0 };
    for (const line of text.split('\n')) {
        const listed = readAnswerLine(line);
        const annotated = listed ? null : ANNOTATED_ANSWER.exec(line);
        if (listed) {
            block.accepted ||= listed.accepted;
            Object.assign(block.chosen, listed.chosen);
        }
        else if (annotated) {
            block.chosen[annotated[1]!] = annotated[2]!.toLowerCase();
            block.comments[annotated[1]!] = annotated[3]!;
        }
        else {
            break;
        }
        block.lineCount++;
    }
    return block;
}

export function writeAnswerBlock(selection: Record<string, string>, comments: Record<string, string>): string {
    return Object.entries(selection)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([number, letter]) => `${number} ${letter}${comments[number] ?? ''}`)
        .join('\n');
}
