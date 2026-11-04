import { createReadStream, statSync } from 'node:fs';

const MAX_PROJECT_FILE_BYTES = 1024 * 1024;

export default defineEventHandler(async (event) => {
    const conversation = findConversation(getRouterParam(event, 'id')!);
    const requested = getQuery(event).path;
    const path = conversation && typeof requested === 'string' ? await projectFilePath(conversation.workingDir, requested) : null;
    if (!path || !statSync(path).isFile()) {
        throw createError({ statusCode: 404, statusMessage: 'File not found' });
    }
    if (statSync(path).size > MAX_PROJECT_FILE_BYTES) {
        throw createError({ statusCode: 413, statusMessage: 'The file is too large to show' });
    }
    setHeader(event, 'content-type', 'text/plain; charset=utf-8');
    setHeader(event, 'cache-control', 'no-store');
    setHeader(event, 'content-security-policy', 'sandbox');
    setHeader(event, 'x-content-type-options', 'nosniff');
    return sendStream(event, createReadStream(path));
});
