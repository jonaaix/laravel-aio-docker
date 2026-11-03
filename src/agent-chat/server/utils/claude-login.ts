import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { getClaudePath } from '#claude-threads/claude/version-check';

const AUTHORIZE_URL = /https:\/\/[^\s\x07\x1B]+\/oauth\/authorize\?[^\s\x07\x1B]+/;
const ESCAPE_SEQUENCES = /\x1B\][^\x07\x1B]*(?:\x07|\x1B\\)|\x1B\[[0-9;?]*[ -/]*[@-~]/g;
const START_TIMEOUT_MS = 30_000;
const CODE_TIMEOUT_MS = 60_000;
const STATUS_POLL_MS = 1_500;
const FAILURE = /error|invalid|failed|denied/i;
const SUCCESS = /login successful|logged in as|signed in as/i;

let child: ChildProcess | null = null;
let output = '';

function shellQuote(value: string): string {
    return `'${value.replaceAll('\'', '\'\\\'\'')}'`;
}

function loginCommand(): string {
    const login = `${shellQuote(getClaudePath())} auth login`;
    const terminal = process.platform === 'darwin' ? `script -q /dev/null ${login}` : `script -qfc ${shellQuote(login)} /dev/null`;
    // Claude Code only offers the code prompt on a terminal; `script` supplies one without a native dependency, and `cat` hands it a plain pipe, since macOS `script` rejects Node's socket stdin.
    return `cat | ${terminal} & wait $!`;
}

function stopGroup(target: ChildProcess): void {
    if (!target.pid) {
        return;
    }
    try {
        process.kill(-target.pid, 'SIGTERM');
    }
    catch {
        target.kill();
    }
}

function lastLine(): string {
    return output.replace(ESCAPE_SEQUENCES, '').split(/[\r\n]+/).map(line => line.trim()).filter(Boolean).at(-1) ?? '';
}

function waitFor<T>(check: () => T | null, timeoutMs: number, timeoutMessage: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const running = child;
        const timer = setTimeout(() => finish(new Error(timeoutMessage)), timeoutMs);
        const onData = () => {
            const value = check();
            if (value !== null) {
                finish(null, value);
            }
        };
        const onExit = (code: number | null) => {
            const value = check();
            if (value !== null) {
                finish(null, value);
                return;
            }
            finish(new Error(code === 0 ? timeoutMessage : lastLine() || 'Sign-in failed.'));
        };
        function finish(error: Error | null, value?: T): void {
            clearTimeout(timer);
            running?.stdout?.off('data', onData);
            running?.off('exit', onExit);
            if (error) {
                reject(error);
            }
            else {
                resolve(value as T);
            }
        }
        running?.stdout?.on('data', onData);
        running?.on('exit', onExit);
        onData();
    });
}

export function cancelClaudeLogin(): void {
    if (child) {
        stopGroup(child);
    }
    child = null;
    output = '';
}

export async function startClaudeLogin(): Promise<string> {
    cancelClaudeLogin();
    const started = spawn('/bin/sh', ['-c', loginCommand()], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, BROWSER: 'none' }, detached: true });
    child = started;
    output = '';
    started.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    started.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString();
    });
    started.on('exit', () => {
        stopGroup(started);
        if (child === started) {
            child = null;
        }
    });
    try {
        return await waitFor(() => output.match(AUTHORIZE_URL)?.[0] ?? null, START_TIMEOUT_MS, 'Claude did not offer a sign-in page.');
    }
    catch (error) {
        cancelClaudeLogin();
        throw error;
    }
}

function credentialsStamp(): number | null {
    const file = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), '.credentials.json');
    return existsSync(file) ? statSync(file).mtimeMs : null;
}

export async function submitClaudeLoginCode(code: string): Promise<void> {
    const running = child;
    if (!running?.stdin) {
        throw new Error('Start the sign-in again.');
    }
    const previous = await readProfile();
    const stamp = credentialsStamp();
    const before = output.length;
    let exitCode: number | null | undefined;
    running.once('exit', (codeOnExit) => {
        exitCode = codeOnExit;
    });
    running.stdin.write(`${code}\r`);
    const deadline = Date.now() + CODE_TIMEOUT_MS;
    while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, STATUS_POLL_MS));
        const reply = output.slice(before).replace(ESCAPE_SEQUENCES, '').split(/[\r\n]+/).map(line => line.trim()).filter(line => line && !line.includes(code));
        const current = await readProfile();
        const switched = current !== null && current.email !== previous?.email;
        if (exitCode === 0 || switched || credentialsStamp() !== stamp || reply.some(line => SUCCESS.test(line))) {
            cancelClaudeLogin();
            return;
        }
        const failure = reply.find(line => FAILURE.test(line));
        if (failure || (exitCode !== undefined && exitCode !== 0)) {
            cancelClaudeLogin();
            throw new Error(failure ?? reply.at(-1) ?? 'The code was not accepted.');
        }
    }
    cancelClaudeLogin();
    throw new Error('Claude did not confirm the sign-in. Start again.');
}
