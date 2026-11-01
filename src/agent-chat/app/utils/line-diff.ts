export interface DiffLine {
    kind: 'added' | 'removed' | 'same';
    text: string;
}

/**
 * Line diff via a longest-common-subsequence table: walking the table from the start emits a line as
 * unchanged where both sides share it, otherwise as removed or added, whichever keeps the longer
 * remaining common subsequence (removals first on a tie). Quadratic in the line counts, so callers cap the input size.
 */
export function lineDiff(before: string, after: string): DiffLine[] {
    const a = before === '' ? [] : before.split('\n');
    const b = after === '' ? [] : after.split('\n');
    const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
        }
    }
    const lines: DiffLine[] = [];
    let i = 0;
    let j = 0;
    while (i < a.length || j < b.length) {
        if (i < a.length && j < b.length && a[i] === b[j]) {
            lines.push({ kind: 'same', text: a[i++]! });
            j++;
        }
        else if (i < a.length && (j === b.length || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
            lines.push({ kind: 'removed', text: a[i++]! });
        }
        else {
            lines.push({ kind: 'added', text: b[j++]! });
        }
    }
    return lines;
}
