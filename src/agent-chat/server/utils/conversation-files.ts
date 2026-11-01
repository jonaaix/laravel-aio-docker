import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, join, resolve } from 'node:path';
import type { ChatPart } from '../../shared/types/conversation';

export const MAX_FILE_BYTES = 2 * 1024 ** 3;
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
    size: number;
}

export function conversationFilesDir(conversationId: string): string {
    return join(resolveDataDir(), 'files', conversationId);
}

export function mediaTypeFor(filename: string): string {
    return MEDIA_TYPES[extname(filename).toLowerCase()] ?? 'application/octet-stream';
}

export function storedNameFor(id: string, filename: string): string {
    return `${id}${extname(filename).toLowerCase().replace(/[^\w.]/g, '')}`;
}

export function fileUIPart(conversationId: string, stored: StoredFile): ChatPart {
    return {
        type: 'file',
        mediaType: stored.mediaType,
        filename: stored.filename,
        url: `conversations/${conversationId}/files/${stored.storedName}`,
        providerMetadata: { agentChat: { size: stored.size } },
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
    return { storedName, filename, mediaType: mediaTypeFor(filename), size };
}

export function conversationFilePath(conversationId: string, storedName: string): string | null {
    if (!STORED_NAME.test(storedName)) {
        return null;
    }
    const path = join(conversationFilesDir(conversationId), storedName);
    return existsSync(path) ? path : null;
}
