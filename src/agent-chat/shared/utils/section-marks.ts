export const SECTION_BAR = /^\s*╌{3,}\s*$/;
export const QUESTION_MARK = '❓';
export const SUMMARY_MARK = '🔑';
export const NEXT_MARK = '🚀';
export const PLAN_MARK = '🎯';

const MARKS = [QUESTION_MARK, SUMMARY_MARK, NEXT_MARK, PLAN_MARK].join('|');
const MARKER_HEADING = new RegExp(`^\\s*(?:#{1,6}\\s+)?(?:\\*\\*)?\\s*((?:${MARKS})\\s*\\S[^\\n]{0,48}?)\\s*(?:\\*\\*)?\\s*:?\\s*$`, 'u');
const MARKER_LEAD = new RegExp(`^\\s*(?:#{1,6}\\s+)?(?:\\*\\*)?\\s*((?:${MARKS})\\s*(?:\\*\\*)?[^:\\n*]{1,30}?)\\s*(?:\\*\\*)?\\s*:\\s*(?:\\*\\*)?\\s*(\\S.*)$`, 'u');

export interface MarkerHeading {
    title: string;
    text: string | null;
}

export function markerHeading(lines: string[], index: number): MarkerHeading | null {
    const line = lines[index] ?? '';
    const standsAlone = index === 0 || (lines[index - 1] ?? '').trim() === '' || SECTION_BAR.test(lines[index - 1] ?? '');
    if (!standsAlone) {
        return null;
    }
    const lead = MARKER_LEAD.exec(line);
    if (lead) {
        return { title: lead[1]!.replaceAll('**', '').trim(), text: lead[2]!.trim() };
    }
    const heading = MARKER_HEADING.exec(line);
    return heading ? { title: heading[1]!.trim(), text: null } : null;
}

export function hasUnbarredSection(text: string): boolean {
    const lines = text.split('\n');
    return lines.some((_, index) => markerHeading(lines, index) !== null
        && !(SECTION_BAR.test(lines[index - 1] ?? '') && SECTION_BAR.test(lines[index + 1] ?? '')));
}
