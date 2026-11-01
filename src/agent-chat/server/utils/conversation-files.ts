import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const STORED_NAME = /^[\w.-]+$/;

const MEDIA_TYPES: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.html': 'text/html',
    '.zip': 'application/zip',
};

export interface StoredFile {
    storedName: string;
    filename: string;
    mediaType: string;
}

function conversationFilesDir(conversationId: string): string {
    return join(resolveDataDir(), 'files', conversationId);
}

export function mediaTypeFor(filename: string): string {
    return MEDIA_TYPES[extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

export function storeConversationFile(conversationId: string, workingDir: string, path: string): StoredFile {
    const source = isAbsolute(path) ? path : resolve(workingDir, path);
    if (!existsSync(source) || !statSync(source).isFile()) {
        throw new Error(`File not found: ${path}`);
    }
    if (statSync(source).size > MAX_FILE_BYTES) {
        throw new Error(`File is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB: ${path}`);
    }
    const filename = basename(source);
    const storedName = `${randomUUID()}${extname(filename).toLowerCase().replace(/[^\w.]/g, '')}`;
    const dir = conversationFilesDir(conversationId);
    mkdirSync(dir, { recursive: true });
    copyFileSync(source, join(dir, storedName));
    return { storedName, filename, mediaType: mediaTypeFor(filename) };
}

export function conversationFilePath(conversationId: string, storedName: string): string | null {
    if (!STORED_NAME.test(storedName)) {
        return null;
    }
    const path = join(conversationFilesDir(conversationId), storedName);
    return existsSync(path) ? path : null;
}
