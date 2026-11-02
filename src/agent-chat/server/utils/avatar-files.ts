import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 10_000;
const AVATAR_FILE = /^(user|agent)-[0-9a-f-]{36}\.(png|jpg|jpeg|webp|gif)$/;
const EXTENSIONS: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
};

function avatarsDir(): string {
    const dir = join(resolveDataDir(), 'avatars');
    mkdirSync(dir, { recursive: true });
    return dir;
}

function clearAvatars(baseName: string): void {
    for (const file of readdirSync(avatarsDir())) {
        if (file.startsWith(`${baseName}.`)) {
            rmSync(join(avatarsDir(), file), { force: true });
        }
    }
}

export function avatarFilePath(file: string): string | null {
    const path = join(avatarsDir(), file);
    return AVATAR_FILE.test(file) && existsSync(path) ? path : null;
}

export function avatarUrl(file: string | null, updatedAt: number | null): string | null {
    return file ? `avatars/${file}?v=${updatedAt ?? 0}` : null;
}

export function removeAvatar(baseName: string): void {
    clearAvatars(baseName);
}

export function storeUploadedAvatar(reference: AttachmentReference, baseName: string): string {
    const extension = EXTENSIONS[mediaTypeFor(reference.filename)];
    if (!extension) {
        throw createError({ statusCode: 422, statusMessage: 'The picture must be a PNG, JPEG, WebP or GIF image' });
    }
    clearAvatars(baseName);
    const file = `${baseName}${extension}`;
    moveUpload(reference, join(avatarsDir(), file));
    if (statSync(join(avatarsDir(), file)).size > MAX_AVATAR_BYTES) {
        clearAvatars(baseName);
        throw createError({ statusCode: 413, statusMessage: 'The picture is larger than 5 MB' });
    }
    return file;
}

export async function downloadAvatar(url: string, baseName: string): Promise<string | null> {
    if (!/^https?:\/\//i.test(url)) {
        return null;
    }
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS), redirect: 'follow' });
        const mediaType = (response.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
        const extension = EXTENSIONS[mediaType];
        const declared = Number(response.headers.get('content-length') ?? 0);
        if (!response.ok || !extension || declared > MAX_AVATAR_BYTES) {
            return null;
        }
        const body = Buffer.from(await response.arrayBuffer());
        if (body.length > MAX_AVATAR_BYTES) {
            return null;
        }
        clearAvatars(baseName);
        const file = `${baseName}${extension}`;
        writeFileSync(join(avatarsDir(), file), body);
        return file;
    }
    catch {
        return null;
    }
}

export function avatarMediaType(file: string): string {
    return Object.entries(EXTENSIONS).find(([, extension]) => extension === extname(file).replace('.jpeg', '.jpg'))?.[0] ?? 'application/octet-stream';
}
