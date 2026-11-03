export const SECTION_BAR = /^\s*╌{3,}\s*$/;
export const QUESTION_MARK = '❓';
export const SUMMARY_MARK = '🔑';
export const NEXT_MARK = '🚀';
export const PLAN_MARK = '🎯';

const MARKER_HEADING = new RegExp(`^\\s*(?:#{1,6}\\s+)?(?:\\*\\*)?\\s*((?:${[QUESTION_MARK, SUMMARY_MARK, NEXT_MARK, PLAN_MARK].join('|')})\\s*\\S[^\\n]{0,48}?)\\s*(?:\\*\\*)?\\s*:?\\s*$`, 'u');

export function markerHeading(lines: string[], index: number): string | null {
    const found = MARKER_HEADING.exec(lines[index] ?? '');
    const standsAlone = index === 0 || (lines[index - 1] ?? '').trim() === '' || SECTION_BAR.test(lines[index - 1] ?? '');
    return found && standsAlone ? found[1]!.trim() : null;
}

export function hasUnbarredSection(text: string): boolean {
    const lines = text.split('\n');
    return lines.some((_, index) => markerHeading(lines, index) !== null
        && !(SECTION_BAR.test(lines[index - 1] ?? '') && SECTION_BAR.test(lines[index + 1] ?? '')));
}
