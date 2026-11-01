export function formatPercent(fraction: number): string {
    return new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }).format(fraction);
}

export function formatResetTime(timestamp: number, now = new Date()): string {
    const moment = new Date(timestamp);
    const time = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(moment);
    if (moment.toDateString() === now.toDateString()) {
        return time;
    }
    return `${new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(moment)} ${time}`;
}
