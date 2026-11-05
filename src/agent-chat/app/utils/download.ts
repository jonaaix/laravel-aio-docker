function fileStamp(date: Date): string {
    const pad = (value: number): string => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function withTimestamp(filename: string, date = new Date()): string {
    const dot = filename.lastIndexOf('.');
    const stamp = fileStamp(date);
    return dot > 0 ? `${filename.slice(0, dot)}-${stamp}${filename.slice(dot)}` : `${filename}-${stamp}`;
}

export function downloadFile(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
}
