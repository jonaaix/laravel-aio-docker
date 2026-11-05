import { createReadStream } from 'node:fs';

export default defineEventHandler((event) => {
    const name = getRouterParam(event, 'name')!;
    const path = /\.html?$/.test(name) ? conversationFilePath(getRouterParam(event, 'id')!, name) : null;
    if (!path) {
        throw createError({ statusCode: 404, statusMessage: 'Page not found' });
    }
    setHeader(event, 'content-type', 'text/html; charset=utf-8');
    setHeader(event, 'cache-control', 'private, max-age=31536000, immutable');
    setHeader(event, 'content-security-policy', 'sandbox allow-scripts');
    setHeader(event, 'x-content-type-options', 'nosniff');
    return sendStream(event, createReadStream(path));
});
