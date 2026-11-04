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

const PREVIEW_LANGUAGES: Record<string, string> = {
    ts: 'ts', tsx: 'tsx', js: 'js', jsx: 'jsx', mjs: 'js', cjs: 'js', vue: 'vue', php: 'php', py: 'python',
    sh: 'bash', bash: 'bash', zsh: 'bash', sql: 'sql', json: 'json', yaml: 'yaml', yml: 'yaml', html: 'html',
    css: 'css', scss: 'css', xml: 'xml', ini: 'ini', env: 'ini', toml: 'ini', diff: 'diff', patch: 'diff',
    dockerfile: 'dockerfile', conf: 'nginx', txt: 'text', log: 'text', csv: 'text', tsv: 'text',
};

export type FilePreview = { kind: 'markdown' } | { kind: 'code'; language: string };

const TEXT_MEDIA_TYPE = /^(text\/|application\/(json|xml|javascript|x-sh|x-httpd-php|sql|toml|yaml)\b)/;

export function filePreview(filename: string): FilePreview | null {
    const extension = fileExtension(filename);
    if (extension === 'md') {
        return { kind: 'markdown' };
    }
    if (filename.toLowerCase().endsWith('.blade.php')) {
        return { kind: 'code', language: 'blade' };
    }
    const language = PREVIEW_LANGUAGES[extension];
    return language ? { kind: 'code', language } : null;
}

export function fencedCode(content: string, language: string): string {
    const longestRun = Math.max(2, ...[...content.matchAll(/`+/g)].map(match => match[0].length));
    const fence = '`'.repeat(longestRun + 1);
    return `${fence}${language}\n${content}\n${fence}`;
}

export function textFilePreview(filename: string): FilePreview {
    return filePreview(filename) ?? { kind: 'code', language: fileLanguage(filename) ?? 'text' };
}

export function isTextMediaType(mediaType: string): boolean {
    return TEXT_MEDIA_TYPE.test(mediaType);
}
