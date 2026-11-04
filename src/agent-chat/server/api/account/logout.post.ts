import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getClaudePath } from '#claude-threads/claude/version-check';

export default defineEventHandler(async (event) => {
    try {
        await promisify(execFile)(getClaudePath(), ['auth', 'logout']);
    }
    catch {
        throw createError({ statusCode: 502, statusMessage: 'Claude could not sign out.' });
    }
    refreshAccountProfile(null);
    return accountStatusFor(sessionUser(event));
});
