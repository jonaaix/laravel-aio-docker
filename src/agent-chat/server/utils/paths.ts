import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function resolveDataDir(): string {
    const dataDir = useRuntimeConfig().dataDir || join(homedir(), '.config', 'agent-chat');
    mkdirSync(dataDir, { recursive: true });
    return dataDir;
}

export function resolveWorkingDir(): string {
    const workingDir = useRuntimeConfig().workingDir || join(resolveDataDir(), 'workspace');
    mkdirSync(workingDir, { recursive: true });
    return workingDir;
}
