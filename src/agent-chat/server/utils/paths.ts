import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { H3Event } from 'h3';

export function resolveDataDir(): string {
    const dataDir = useRuntimeConfig().dataDir || join(homedir(), '.config', 'agent-chat');
    mkdirSync(dataDir, { recursive: true });
    return dataDir;
}

export function shadowGitBase(): string {
    return join(resolveDataDir(), 'shadow-git');
}

export function localServerOrigin(event: H3Event): string {
    const port = event.node.req.socket.localPort ?? getRequestURL(event).port;
    return `http://127.0.0.1:${port}`;
}

export function claudeSessionExists(workingDir: string, sessionRef: string): boolean {
    const configDir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
    return existsSync(join(configDir, 'projects', workingDir.replace(/[^a-zA-Z0-9]/g, '-'), `${sessionRef}.jsonl`));
}

export function resolveWorkingDir(): string {
    const workingDir = useRuntimeConfig().workingDir || join(resolveDataDir(), 'workspace');
    mkdirSync(workingDir, { recursive: true });
    return workingDir;
}
