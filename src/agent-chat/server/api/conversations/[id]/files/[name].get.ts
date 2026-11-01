import { createReadStream } from 'node:fs';

export default defineEventHandler((event) => {
    const path = conversationFilePath(getRouterParam(event, 'id')!, getRouterParam(event, 'name')!);
    if (!path) {
        throw createError({ statusCode: 404, statusMessage: 'File not found' });
    }
    setHeader(event, 'content-type', mediaTypeFor(path));
    setHeader(event, 'cache-control', 'private, max-age=31536000, immutable');
    setHeader(event, 'content-security-policy', 'sandbox');
    setHeader(event, 'x-content-type-options', 'nosniff');
    return sendStream(event, createReadStream(path));
});
