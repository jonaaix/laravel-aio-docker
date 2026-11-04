import type { ChatMessage, FileChange, StepFileChanges, TurnFileChanges } from '#shared/types/conversation';
import type { DiffLine } from './line-diff';

function diffLine(line: string): DiffLine {
    if (line.startsWith('@@')) {
        return { kind: 'gap', text: '⋯' };
    }
    if (line.startsWith('+')) {
        return { kind: 'added', text: line.slice(1) };
    }
    if (line.startsWith('-')) {
        return { kind: 'removed', text: line.slice(1) };
    }
    return { kind: 'same', text: line.slice(1) };
}

export function unifiedDiffLines(lines: string[]): DiffLine[] {
    return lines.map(diffLine).filter((line, index) => index > 0 || line.kind !== 'gap');
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
