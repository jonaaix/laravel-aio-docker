const CODE_EXTENSIONS = new Set([
    'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'vue', 'php', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'c', 'h', 'cpp', 'cs',
    'sh', 'bash', 'zsh', 'sql', 'html', 'css', 'scss', 'json', 'yaml', 'yml', 'xml', 'toml', 'ini', 'env', 'dockerfile',
]);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'log', 'rtf']);
const TABLE_EXTENSIONS = new Set(['csv', 'tsv', 'xls', 'xlsx', 'ods']);
const ARCHIVE_EXTENSIONS = new Set(['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar']);

export function fileExtension(filename: string): string {
    const dot = filename.lastIndexOf('.');
    return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

export function fileIcon(filename: string): string {
    const extension = fileExtension(filename);
    if (CODE_EXTENSIONS.has(extension)) {
        return 'i-heroicons-code-bracket';
    }
    if (TEXT_EXTENSIONS.has(extension)) {
        return 'i-heroicons-document-text';
    }
    if (TABLE_EXTENSIONS.has(extension)) {
        return 'i-heroicons-table-cells';
    }
    if (ARCHIVE_EXTENSIONS.has(extension)) {
        return 'i-heroicons-archive-box';
    }
    return 'i-heroicons-document';
}
