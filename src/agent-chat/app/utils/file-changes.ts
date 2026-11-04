import type { ChatMessage, FileChange, StepFileChanges, TurnFileChanges } from '#shared/types/conversation';
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

export function stepFileChanges(message: ChatMessage): Map<string, FileChange[]> {
    const steps = new Map<string, FileChange[]>();
    for (const part of message.parts) {
        if (part.type === 'data-file-changes') {
            const { toolCallId, files } = part.data as StepFileChanges;
            steps.set(toolCallId, [...steps.get(toolCallId) ?? [], ...files]);
        }
    }
    return steps;
}

export function turnFileChanges(message: ChatMessage): FileChange[] {
    const part = message.parts.findLast(candidate => candidate.type === 'data-turn-changes');
    return part && 'data' in part ? (part.data as TurnFileChanges).files : [];
}
