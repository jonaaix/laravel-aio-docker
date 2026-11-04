import type { ChatMessage, FileChange, TurnFileChanges } from '#shared/types/conversation';
import type { DiffLine } from './line-diff';

const HUNK_START = /^@@ -(\d+)(?:,\d+)? \+(\d+)/;

export function unifiedDiffLines(lines: string[]): DiffLine[] {
    let oldNumber = 0;
    let newNumber = 0;
    const result = lines.map((line): DiffLine => {
        const hunk = line.match(HUNK_START);
        if (hunk) {
            oldNumber = Number(hunk[1]);
            newNumber = Number(hunk[2]);
            return { kind: 'gap', text: '⋯' };
        }
        if (line.startsWith('+')) {
            return { kind: 'added', text: line.slice(1), number: newNumber++ };
        }
        if (line.startsWith('-')) {
            return { kind: 'removed', text: line.slice(1), number: oldNumber++ };
        }
        oldNumber++;
        return { kind: 'same', text: line.slice(1), number: newNumber++ };
    });
    return result.filter((line, index) => index > 0 || line.kind !== 'gap');
}

export function turnFileChanges(message: ChatMessage): TurnFileChanges {
    const part = message.parts.findLast(candidate => candidate.type === 'data-turn-changes');
    const data = part && 'data' in part ? part.data as Partial<TurnFileChanges> : {};
    return { files: data.files ?? [] };
}

export function changeTotals(files: FileChange[]): { added: number; removed: number } {
    return {
        added: files.reduce((sum, file) => sum + file.added, 0),
        removed: files.reduce((sum, file) => sum + file.removed, 0),
    };
}
