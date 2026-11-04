import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import type { FileChange } from '../../shared/types/conversation';

const run = promisify(execFile);
const GIT_OUTPUT_LIMIT = 64 * 1024 * 1024;
// A formatter run can touch hundreds of files; past this budget files keep their counts but lose their lines.
const MAX_LINES_PER_FILE = 1_000;
const MAX_LINES_PER_CHANGE = 5_000;

function headerPath(header: string): string {
    const match = header.match(/^diff --git a\/.+ b\/(.+)$/);
    return match?.[1] ?? '';
}

function fileChange(section: string): FileChange {
    const lines = section.split('\n');
    if (lines.at(-1) === '') {
        lines.pop();
    }
    const hunkStart = lines.findIndex(line => line.startsWith('@@'));
    const header = hunkStart === -1 ? lines : lines.slice(0, hunkStart);
    const body = hunkStart === -1 ? [] : lines.slice(hunkStart).filter(line => !line.startsWith('\\'));
    const change: FileChange = { path: '', previousPath: null, status: 'modified', added: 0, removed: 0, binary: false, lines: [], truncated: false };
    for (const line of header) {
        if (line.startsWith('new file mode')) {
            change.status = 'added';
        }
        else if (line.startsWith('deleted file mode')) {
            change.status = 'deleted';
        }
        else if (line.startsWith('rename from ')) {
            change.status = 'renamed';
            change.previousPath = line.slice('rename from '.length);
        }
        else if (line.startsWith('rename to ')) {
            change.path = line.slice('rename to '.length);
        }
        else if (line.startsWith('+++ b/')) {
            change.path = line.slice('+++ b/'.length);
        }
        else if (line.startsWith('--- a/') && !change.path) {
            change.path = line.slice('--- a/'.length);
        }
        else if (line.startsWith('Binary files ')) {
            change.binary = true;
        }
    }
    change.path ||= headerPath(header[0] ?? '');
    change.added = body.filter(line => line.startsWith('+')).length;
    change.removed = body.filter(line => line.startsWith('-')).length;
    change.lines = body.slice(0, MAX_LINES_PER_FILE);
    change.truncated = body.length > MAX_LINES_PER_FILE;
    return change;
}

function withinBudget(changes: FileChange[]): FileChange[] {
    let budget = MAX_LINES_PER_CHANGE;
    return changes.map((change) => {
        if (change.lines.length <= budget) {
            budget -= change.lines.length;
            return change;
        }
        budget = 0;
        return { ...change, lines: [], truncated: change.lines.length > 0 };
    });
}

export function parsePatch(patch: string): FileChange[] {
    return withinBudget(patch.split(/^(?=diff --git )/m).filter(section => section.startsWith('diff --git ')).map(fileChange));
}

async function isIgnored(root: string, path: string): Promise<boolean | null> {
    try {
        await run('git', ['check-ignore', '--quiet', '--', path], { cwd: root });
        return true;
    }
    catch (error) {
        return (error as { code?: unknown }).code === 1 ? false : null;
    }
}

export async function projectFilePath(dir: string, path: string): Promise<string | null> {
    try {
        const { stdout } = await run('git', ['rev-parse', '--show-toplevel'], { cwd: dir });
        const root = realpathSync(stdout.trim());
        const target = realpathSync(resolve(root, path));
        const inside = relative(root, target);
        if (!target.startsWith(root + sep) || inside.split(sep)[0] === '.git') {
            return null;
        }
        return await isIgnored(root, inside) === false ? target : null;
    }
    catch {
        return null;
    }
}

export class WorkingTree {
    private constructor(private readonly root: string, private readonly indexFile: string) {}

    static async open(dir: string, indexFile: string): Promise<WorkingTree | null> {
        try {
            const { stdout } = await run('git', ['rev-parse', '--show-toplevel', '--git-path', 'index'], { cwd: dir });
            const [root, index] = stdout.trim().split('\n');
            if (!root || !index) {
                return null;
            }
            const realIndex = isAbsolute(index) ? index : join(dir, index);
            mkdirSync(dirname(indexFile), { recursive: true });
            rmSync(indexFile, { force: true });
            if (existsSync(realIndex)) {
                copyFileSync(realIndex, indexFile);
            }
            return new WorkingTree(root, indexFile);
        }
        catch {
            return null;
        }
    }

    async snapshot(): Promise<string> {
        await this.git(['add', '--all', '--', '.']);
        return (await this.git(['write-tree'])).trim();
    }

    async changes(from: string, to: string): Promise<FileChange[]> {
        if (from === to) {
            return [];
        }
        return parsePatch(await this.git(['diff', '--no-color', '--no-ext-diff', '--find-renames', '--unified=3', from, to]));
    }

    private async git(args: string[]): Promise<string> {
        const { stdout } = await run('git', ['-c', 'core.quotePath=false', ...args], {
            cwd: this.root,
            env: { ...process.env, GIT_INDEX_FILE: this.indexFile },
            maxBuffer: GIT_OUTPUT_LIMIT,
        });
        return stdout;
    }
}

export class ChangeTracker {
    private tree: Promise<WorkingTree | null> | null = null;
    private work: Promise<void> = Promise.resolve();
    private turnStart: string | null = null;
    private latest: string | null = null;

    constructor(private readonly dir: string, private readonly indexFile: string) {}

    beginTurn(): void {
        this.queue(async (tree) => {
            this.turnStart = await tree.snapshot();
            this.latest = this.turnStart;
        });
    }

    afterStep(found: (turnChanges: FileChange[], recentPaths: string[]) => void): void {
        this.queue(async (tree) => {
            const previous = this.latest;
            this.latest = await tree.snapshot();
            const step = previous ? await tree.changes(previous, this.latest) : [];
            if (step.length > 0 && this.turnStart) {
                found(await tree.changes(this.turnStart, this.latest), step.map(change => change.path));
            }
        });
    }

    endTurn(found: (turnChanges: FileChange[]) => void): void {
        this.queue(async (tree) => {
            const start = this.turnStart;
            this.turnStart = null;
            this.latest = await tree.snapshot();
            if (start) {
                found(await tree.changes(start, this.latest));
            }
        });
    }

    dispose(): void {
        this.work = this.work.then(() => rmSync(this.indexFile, { force: true }));
        this.tree = null;
        this.turnStart = null;
        this.latest = null;
    }

    private queue(step: (tree: WorkingTree) => Promise<void>): void {
        this.tree ??= WorkingTree.open(this.dir, this.indexFile);
        const tree = this.tree;
        this.work = this.work
            .then(async () => {
                const opened = await tree;
                if (opened) {
                    await step(opened);
                }
            })
            .catch((error: unknown) => console.warn('[agent-chat] Could not compare the working tree:', error));
    }
}
