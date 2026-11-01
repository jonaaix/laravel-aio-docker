export function formatPercent(fraction: number): string {
    return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}

export function formatClockTime(timestamp: number, now = new Date()): string {
    const moment = new Date(timestamp);
    const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(moment);
    if (moment.toDateString() === now.toDateString()) {
        return time;
    }
    return `${new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(moment)} ${time}`;
}

const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

export function formatBytes(bytes: number): string {
    const exponent = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)));
    return new Intl.NumberFormat(undefined, {
        style: 'unit',
        unit: BYTE_UNITS[exponent],
        unitDisplay: 'short',
        maximumFractionDigits: exponent === 0 ? 0 : 1,
    }).format(bytes / 1024 ** exponent);
}

export function formatElapsed(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
