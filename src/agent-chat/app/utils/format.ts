const formatLocale = shallowRef<string | undefined>();

export function setFormatLocale(code: string): void {
    formatLocale.value = code;
}

export function formatPercent(fraction: number): string {
    return new Intl.NumberFormat(formatLocale.value, { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}

export function formatClockTime(timestamp: number, now = new Date()): string {
    const moment = new Date(timestamp);
    const time = new Intl.DateTimeFormat(formatLocale.value, { hour: '2-digit', minute: '2-digit', hour12: false }).format(moment);
    if (moment.toDateString() === now.toDateString()) {
        return time;
    }
    return `${new Intl.DateTimeFormat(formatLocale.value, { weekday: 'short' }).format(moment)} ${time}`;
}

const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

export function formatBytes(bytes: number): string {
    const exponent = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)));
    return new Intl.NumberFormat(formatLocale.value, {
        style: 'unit',
        unit: BYTE_UNITS[exponent],
        unitDisplay: 'short',
        maximumFractionDigits: exponent === 0 ? 0 : 1,
    }).format(bytes / 1024 ** exponent);
}

const RELATIVE_UNITS = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
] as const;

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
    const seconds = Math.round((timestamp - now) / 1000);
    const formatter = new Intl.RelativeTimeFormat(formatLocale.value, { numeric: 'auto', style: 'short' });
    const [unit, size] = RELATIVE_UNITS.find(([, unitSeconds]) => Math.abs(seconds) >= unitSeconds) ?? ['minute', 60];
    return formatter.format(Math.round(seconds / size), unit);
}

export function formatElapsed(milliseconds: number): string {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}
