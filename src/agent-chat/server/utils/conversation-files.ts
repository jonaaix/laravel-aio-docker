import { randomUUID } from 'node:crypto';
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import type { ChatPart } from '../../shared/types/conversation';

export const MAX_FILE_BYTES = 2 * 1024 ** 3;
const STORED_NAME = /^[\w.-]+$/;
const TEXT_SNIFF_BYTES = 8192;
const UNKNOWN_MEDIA_TYPE = 'application/octet-stream';

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
    size: number;
}

export function conversationFilesDir(conversationId: string): string {
    return join(resolveDataDir(), 'files', conversationId);
}

export function mediaTypeFor(filename: string): string {
    return MEDIA_TYPES[extname(filename).toLowerCase()] ?? UNKNOWN_MEDIA_TYPE;
}

function looksLikeText(path: string): boolean {
    const head = Buffer.alloc(TEXT_SNIFF_BYTES);
    const file = openSync(path, 'r');
    const length = readSync(file, head, 0, TEXT_SNIFF_BYTES, 0);
    closeSync(file);
    const bytes = head.subarray(0, length);
    if (bytes.includes(0)) {
        return false;
    }
    try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: true });
        return true;
    }
    catch {
        return false;
    }
}

export function detectedMediaType(path: string, filename: string): string {
    const known = mediaTypeFor(filename);
    return known === UNKNOWN_MEDIA_TYPE && looksLikeText(path) ? 'text/plain' : known;
}

export function storedNameFor(id: string, filename: string): string {
    return `${id}${extname(filename).toLowerCase().replace(/[^\w.]/g, '')}`;
}

export function fileUIPart(conversationId: string, stored: StoredFile, caption?: string): ChatPart {
    return {
        type: 'file',
        mediaType: stored.mediaType,
        filename: stored.filename,
        url: `conversations/${conversationId}/files/${stored.storedName}`,
        providerMetadata: { agentChat: caption ? { size: stored.size, caption } : { size: stored.size } },
    };
}

export function storeConversationFile(conversationId: string, workingDir: string, path: string): StoredFile {
    const source = isAbsolute(path) ? path : resolve(workingDir, path);
    if (!existsSync(source) || !statSync(source).isFile()) {
        throw new Error(`File not found: ${path}`);
    }
    const { size } = statSync(source);
    if (size > MAX_FILE_BYTES) {
        throw new Error(`File is larger than 2 GB: ${path}`);
    }
    const filename = basename(source);
    const storedName = storedNameFor(randomUUID(), filename);
    const dir = conversationFilesDir(conversationId);
    mkdirSync(dir, { recursive: true });
    copyFileSync(source, join(dir, storedName));
    return { storedName, filename, mediaType: detectedMediaType(source, filename), size };
}

export function conversationFilePath(conversationId: string, storedName: string): string | null {
    if (!STORED_NAME.test(storedName)) {
        return null;
    }
    const path = join(conversationFilesDir(conversationId), storedName);
    return existsSync(path) ? path : null;
}
