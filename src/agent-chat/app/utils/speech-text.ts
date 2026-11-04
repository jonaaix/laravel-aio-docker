const DEVICE_CHUNK_LENGTH = 200;

const MARKDOWN_RULES: [RegExp, string][] = [
    [/```[\s\S]*?(?:```|$)/g, '\n'],
    [/!\[[^\]]*\]\([^)]*\)/g, ' '],
    [/\[([^\]]+)\]\([^)]*\)/g, '$1'],
    [/`([^`]*)`/g, '$1'],
    [/<\/?[a-z][^>]*>/gi, ' '],
    [/^\s*(?:[-*_]\s*){3,}$/gm, ''],
    [/^\s*(?:#{1,6}|>+|[-*+]|\d+[.)])\s+/gm, ''],
    [/[╌─━═]{2,}/g, ''],
    [/\p{Extended_Pictographic}️?/gu, ''],
    [/[*_~|]+/g, ' '],
    [/[ \t]+/g, ' '],
    [/\s*\n\s*/g, '\n'],
];

export function speakableText(markdown: string): string {
    return MARKDOWN_RULES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), markdown).trim();
}

function splitLong(piece: string, maxLength: number): string[] {
    if (piece.length <= maxLength) {
        return [piece];
    }
    const words = piece.split(' ');
    const chunks: string[] = [];
    let current = '';
    for (const word of words) {
        if (current && current.length + word.length + 1 > maxLength) {
            chunks.push(current);
            current = word;
        }
        else {
            current = current ? `${current} ${word}` : word;
        }
    }
    return current ? [...chunks, current] : chunks;
}

export function speechChunks(text: string, maxLength = DEVICE_CHUNK_LENGTH): string[] {
    const sentences = text.split(/(?<=[.!?…:;])\s+|\n+/).map(sentence => sentence.trim()).filter(Boolean);
    const chunks: string[] = [];
    for (const sentence of sentences.flatMap(sentence => splitLong(sentence, maxLength))) {
        const last = chunks.at(-1);
        if (last !== undefined && last.length + sentence.length + 1 <= maxLength) {
            chunks[chunks.length - 1] = `${last} ${sentence}`;
        }
        else {
            chunks.push(sentence);
        }
    }
    return chunks;
}
