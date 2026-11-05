const SUFFIX_LENGTH = 6;

export function withRandomSuffix(filename: string): string {
    const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, SUFFIX_LENGTH);
    const dot = filename.lastIndexOf('.');
    return dot > 0 ? `${filename.slice(0, dot)}-${suffix}${filename.slice(dot)}` : `${filename}-${suffix}`;
}

export function downloadFile(url: string, filename: string): void {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
}
