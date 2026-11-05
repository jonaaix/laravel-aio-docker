import type { UiTimelineGroup, UiTimelineItem, UiTimelineState } from '#shared/types/ui-block';

const MIN_HOUR_PX = 48;
const MIN_SPAN_PX = 44;
const MAX_HEIGHT_PX = 1600;
const MIN_BLOCK_PX = 22;
const POINT_PX = 28;
const MIN_TICK_GAP_PX = 40;
const MINUTES_PER_DAY = 1440;
const TICK_STEPS = [15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080];

export interface ScheduleEntry {
    item: UiTimelineItem;
    top: number;
    height: number;
    column: number;
    columns: number;
    point: boolean;
}

export interface ScheduleLane {
    name: string | null;
    entries: ScheduleEntry[];
}

export interface ScheduleLayout {
    height: number;
    ticks: { top: number; minute: number }[];
    lanes: ScheduleLane[];
}

function pixelsPerMinute(span: number, shortest: number): number {
    const readable = Math.max(MIN_HOUR_PX / 60, MIN_SPAN_PX / shortest);
    return span * readable > MAX_HEIGHT_PX ? MAX_HEIGHT_PX / span : readable;
}

function spreadOverlaps(entries: ScheduleEntry[]): void {
    let cluster: ScheduleEntry[] = [];
    let clusterBottom = -Infinity;
    const columnBottoms: number[] = [];
    const close = (): void => {
        cluster.forEach(entry => entry.columns = columnBottoms.length);
        cluster = [];
        columnBottoms.length = 0;
    };
    for (const entry of [...entries].sort((first, second) => first.top - second.top)) {
        if (entry.top >= clusterBottom) {
            close();
        }
        const free = columnBottoms.findIndex(bottom => bottom <= entry.top);
        entry.column = free === -1 ? columnBottoms.length : free;
        columnBottoms[entry.column] = entry.top + entry.height;
        cluster.push(entry);
        clusterBottom = cluster.length === 1 ? entry.top + entry.height : Math.max(clusterBottom, entry.top + entry.height);
    }
    close();
}

export function scheduleLayout(group: UiTimelineGroup): ScheduleLayout {
    const items = group.items.filter(item => item.start != null);
    const from = Math.min(...items.map(item => item.start!));
    const until = Math.max(...items.map(item => item.end ?? item.start!));
    const spans = items.filter(item => item.end != null).map(item => item.end! - item.start!);
    const scale = pixelsPerMinute(Math.max(until - from, 60), spans.length > 0 ? Math.min(...spans) : 60);
    const step = TICK_STEPS.find(minutes => minutes * scale >= MIN_TICK_GAP_PX) ?? Math.ceil(MIN_TICK_GAP_PX / scale / MINUTES_PER_DAY) * MINUTES_PER_DAY;
    const rangeStart = Math.floor(from / step) * step;
    const rangeEnd = Math.max(Math.ceil(until / step) * step, rangeStart + step, until + POINT_PX / scale);
    const ticks = [];
    for (let minute = rangeStart; minute <= rangeEnd; minute += step) {
        ticks.push({ top: (minute - rangeStart) * scale, minute });
    }
    const laneNames = [...new Set(items.map(item => item.lane ?? null))];
    const lanes = laneNames.map((name) => {
        const entries = items.filter(item => (item.lane ?? null) === name).map(item => ({
            item,
            top: (item.start! - rangeStart) * scale,
            height: item.end != null ? Math.max((item.end - item.start!) * scale, MIN_BLOCK_PX) : POINT_PX,
            column: 0,
            columns: 1,
            point: item.end == null,
        }));
        spreadOverlaps(entries);
        return { name, entries };
    });
    return { height: (rangeEnd - rangeStart) * scale, ticks, lanes };
}

const DOT_LOOK: Record<UiTimelineState | 'none', string> = {
    done: 'bg-primary',
    active: 'bg-primary shadow-[0_0_6px_1px_var(--ui-primary)]',
    open: 'bg-default ring-2 ring-inset ring-(--ui-text-dimmed)',
    none: 'bg-(--ui-text-dimmed)',
};

const BLOCK_LOOK: Record<UiTimelineState | 'none', string> = {
    done: 'bg-[color-mix(in_oklab,var(--ui-primary)_10%,var(--ui-bg))] ring-primary/30',
    active: 'bg-[color-mix(in_oklab,var(--ui-primary)_15%,var(--ui-bg))] ring-primary',
    open: 'bg-default ring-accented',
    none: 'bg-elevated ring-default',
};

export function timelineDotLook(state: UiTimelineState | null): string {
    return DOT_LOOK[state ?? 'none'];
}

export function timelineBlockLook(state: UiTimelineState | null): string {
    return BLOCK_LOOK[state ?? 'none'];
}
