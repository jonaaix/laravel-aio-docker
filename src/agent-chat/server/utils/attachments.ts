import { randomUUID } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { H3Event } from 'h3';
import type { UploadedFile } from '../../shared/types/conversation';
import type { StoredFile } from './conversation-files';

const UPLOAD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const MAX_FILENAME_LENGTH = 200;
const FILE_LIST_HEADER = '[Attached files from chat — saved to disk, use Read or move/copy as needed:]';
const BYTE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

export interface AttachmentReference {
    id: string;
    filename: string;
}

function uploadsDir(): string {
    return join(resolveDataDir(), 'uploads');
}

function uploadPath(id: string): string {
    return join(uploadsDir(), id);
}

function safeFilename(name: string): string {
    const cleaned = basename(name.replace(/\\/g, '/')).replace(/[\u0000-\u001F]/g, '').trim();
    return cleaned.slice(0, MAX_FILENAME_LENGTH) || 'file';
}

function formatSize(bytes: number): string {
    const exponent = Math.min(BYTE_UNITS.length - 1, Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)));
    const value = bytes / 1024 ** exponent;
    return `${exponent === 0 ? value : value.toFixed(1)} ${BYTE_UNITS[exponent]}`;
}

export function clearUploads(): void {
    rmSync(uploadsDir(), { recursive: true, force: true });
}

export async function receiveUpload(event: H3Event, name: string): Promise<UploadedFile> {
    const id = randomUUID();
    const filename = safeFilename(name);
    mkdirSync(uploadsDir(), { recursive: true });
    let size = 0;
    const limit = new Transform({
        transform(chunk: Buffer, _encoding, done) {
            size += chunk.length;
            done(size > MAX_FILE_BYTES ? new Error('too large') : null, chunk);
        },
    });
    try {
        await pipeline(event.node.req, limit, createWriteStream(uploadPath(id)));
    }
    catch {
        rmSync(uploadPath(id), { force: true });
        throw size > MAX_FILE_BYTES
            ? createError({ statusCode: 413, statusMessage: 'File is larger than 2 GB' })
            : createError({ statusCode: 400, statusMessage: 'Upload failed' });
    }
    return { id, filename, mediaType: mediaTypeFor(filename), size };
}

export function discardUpload(id: string): void {
    if (UPLOAD_ID.test(id)) {
        rmSync(uploadPath(id), { force: true });
    }
}

export function readAttachmentReferences(value: unknown): AttachmentReference[] {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value)) {
        throw createError({ statusCode: 422, statusMessage: 'Attachments must be a list' });
    }
    return value.map((item) => {
        const { id, filename } = (item ?? {}) as Record<string, unknown>;
        if (typeof id !== 'string' || !UPLOAD_ID.test(id) || typeof filename !== 'string' || !existsSync(uploadPath(id))) {
            throw createError({ statusCode: 422, statusMessage: 'Attachment not found' });
        }
        return { id, filename: safeFilename(filename) };
    });
}

export function moveUpload(reference: AttachmentReference, target: string): void {
    renameSync(uploadPath(reference.id), target);
}

export function adoptUploads(conversationId: string, references: AttachmentReference[]): StoredFile[] {
    if (references.length === 0) {
        return [];
    }
    const dir = conversationFilesDir(conversationId);
    mkdirSync(dir, { recursive: true });
    return references.map((reference) => {
        const storedName = storedNameFor(reference.id, reference.filename);
        const target = join(dir, storedName);
        renameSync(uploadPath(reference.id), target);
        return { storedName, filename: reference.filename, mediaType: mediaTypeFor(reference.filename), size: statSync(target).size };
    });
}

export function promptWithAttachments(conversationId: string, text: string, attachments: StoredFile[]): string {
    if (attachments.length === 0) {
        return text;
    }
    const lines = attachments.map(file => `- ${join(conversationFilesDir(conversationId), file.storedName)} (${file.mediaType}, ${formatSize(file.size)})`);
    const header = `${FILE_LIST_HEADER}\n${lines.join('\n')}`;
    return text.trim() ? `${header}\n\n${text}` : header;
}
