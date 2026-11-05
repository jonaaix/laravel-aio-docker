const formatLocale = shallowRef<string | undefined>();

export function setFormatLocale(code: string): void {
    formatLocale.value = code;
}

export function formatPercent(fraction: number): string {
    return new Intl.NumberFormat(formatLocale.value, { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}

export function formatBadgeCount(count: number, cap = 99): string {
    const format = new Intl.NumberFormat(formatLocale.value);
    return count > cap ? `${format.format(cap)}+` : format.format(count);
}

export function formatScreenSize(width: number, height: number): string {
    const format = new Intl.NumberFormat(formatLocale.value, { maximumFractionDigits: 0 });
    return `${format.format(width)} × ${format.format(height)} px`;
}

export function formatAmount(value: number, unit: string | null = null): string {
    const number = new Intl.NumberFormat(formatLocale.value, { maximumFractionDigits: 2 }).format(value);
    return unit ? `${number} ${unit}` : number;
}

export function formatSpeedFactor(factor: number): string {
    return `${new Intl.NumberFormat(formatLocale.value, { maximumFractionDigits: 2 }).format(factor)}×`;
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function dateFormat(name: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
    const key = `${formatLocale.value ?? ''}|${name}`;
    let format = dateFormats.get(key);
    if (!format) {
        format = new Intl.DateTimeFormat(formatLocale.value, options);
        dateFormats.set(key, format);
    }
    return format;
}

export function formatClockTime(timestamp: number, now = new Date()): string {
    const moment = new Date(timestamp);
    const time = dateFormat('clock', { hour: '2-digit', minute: '2-digit', hour12: false }).format(moment);
    if (moment.toDateString() === now.toDateString()) {
        return time;
    }
    return `${dateFormat('weekday', { weekday: 'short' }).format(moment)} ${time}`;
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

export function formatDollars(amount: number): string {
    return new Intl.NumberFormat(formatLocale.value, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
}
