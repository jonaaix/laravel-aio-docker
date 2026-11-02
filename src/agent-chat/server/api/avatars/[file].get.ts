import { createReadStream } from 'node:fs';

export default defineEventHandler((event) => {
    const file = getRouterParam(event, 'file') ?? '';
    const path = avatarFilePath(file);
    if (!path) {
        throw createError({ statusCode: 404, statusMessage: 'Picture not found' });
    }
    setHeader(event, 'content-type', avatarMediaType(file));
    setHeader(event, 'cache-control', 'private, max-age=31536000, immutable');
    return sendStream(event, createReadStream(path));
});
