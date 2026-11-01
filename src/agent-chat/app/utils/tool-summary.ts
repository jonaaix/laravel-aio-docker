const SUMMARY_KEYS = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description'] as const;
const PATH_KEYS = new Set<string>(['file_path', 'path']);

function relativePath(path: string, workingDir: string): string {
    const prefix = `${workingDir.replace(/\/+$/, '')}/`;
    return workingDir !== '' && path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

export function toolSummary(input: unknown, workingDir = ''): string {
    if (!input || typeof input !== 'object') {
        return '';
    }
    const record = input as Record<string, unknown>;
    const key = SUMMARY_KEYS.find(candidate => typeof record[candidate] === 'string');
    if (!key) {
        return '';
    }
    const value = String(record[key]);
    return PATH_KEYS.has(key) ? relativePath(value, workingDir) : value;
}

export function toolDetail(value: unknown): string {
    if (value === undefined || value === null) {
        return '';
    }
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function toolDescription(input: unknown, workingDir = ''): string {
    const description = input && typeof input === 'object' ? (input as Record<string, unknown>).description : undefined;
    return typeof description === 'string' && description.trim() ? description.trim() : toolSummary(input, workingDir);
}

export function toolDisplayName(name: string): string {
    const bare = name.replace(/^mcp__[^_]+__/, '');
    return bare === name ? name : bare.charAt(0).toUpperCase() + bare.slice(1).replace(/_/g, ' ');
}
