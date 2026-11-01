const SUMMARY_KEYS = ['command', 'file_path', 'path', 'pattern', 'url', 'query', 'description'] as const;

export function toolSummary(input: unknown): string {
    if (!input || typeof input !== 'object') {
        return '';
    }
    const record = input as Record<string, unknown>;
    const key = SUMMARY_KEYS.find(candidate => typeof record[candidate] === 'string');
    return key ? String(record[key]) : '';
}

export function toolDetail(value: unknown): string {
    if (value === undefined || value === null) {
        return '';
    }
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function toolDescription(input: unknown): string {
    const description = input && typeof input === 'object' ? (input as Record<string, unknown>).description : undefined;
    return typeof description === 'string' && description.trim() ? description.trim() : toolSummary(input);
}

export function toolDisplayName(name: string): string {
    const bare = name.replace(/^mcp__[^_]+__/, '');
    return bare === name ? name : bare.charAt(0).toUpperCase() + bare.slice(1).replace(/_/g, ' ');
}
