import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import type { FileChange, TurnCommit, TurnFileChanges } from '../../shared/types/conversation';

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

// Without a project .gitignore these would land in the chat's own archive and in diffs: secrets and bulky folders.
const SHADOW_EXCLUDES = ['.git/', '.env', '.env.*', '*.key', '*.pem', '*.p12', '*.pfx', 'id_rsa*', 'id_ed25519*', '.ssh/', 'node_modules/', 'vendor/', 'storage/', 'dist/', 'build/'];

const COMMIT_LIMIT = 50;
const FIELD = '\x1f';
const RECORD = '\x1e';

function commitStat(line: string): { files: number; added: number; removed: number } {
    const count = (pattern: RegExp) => Number(line.match(pattern)?.[1] ?? 0);
    return { files: count(/(\d+) files? changed/), added: count(/(\d+) insertions?\(\+\)/), removed: count(/(\d+) deletions?\(-\)/) };
}

interface GitLocation {
    root: string;
    env: Record<string, string>;
    index: string | null;
}

function shadowDir(shadowBase: string, root: string): string {
    return join(shadowBase, createHash('sha256').update(root).digest('hex').slice(0, 16));
}

async function projectRepository(dir: string): Promise<{ root: string; index: string } | null> {
    try {
        const { stdout } = await run('git', ['rev-parse', '--show-toplevel', '--git-path', 'index'], { cwd: dir });
        const [root, index] = stdout.trim().split('\n');
        return root && index ? { root: realpathSync(root), index: isAbsolute(index) ? index : join(dir, index) } : null;
    }
    catch {
        return null;
    }
}

async function shadowRepository(root: string, shadowBase: string, create: boolean): Promise<GitLocation | null> {
    const base = resolve(shadowBase);
    if (base === root || base.startsWith(root + sep)) {
        return null;
    }
    const gitDir = join(shadowDir(base, root), '.git');
    if (!existsSync(gitDir)) {
        if (!create) {
            return null;
        }
        await run('git', ['init', '--quiet', dirname(gitDir)]);
        writeFileSync(join(gitDir, 'info', 'exclude'), `${SHADOW_EXCLUDES.join('\n')}\n`);
    }
    return { root, env: { GIT_DIR: gitDir, GIT_WORK_TREE: root }, index: null };
}

async function locateGit(dir: string, shadowBase: string, create: boolean): Promise<GitLocation | null> {
    const repository = await projectRepository(dir);
    if (repository) {
        rmSync(shadowDir(resolve(shadowBase), repository.root), { recursive: true, force: true });
        return { root: repository.root, env: {}, index: repository.index };
    }
    return existsSync(dir) ? shadowRepository(realpathSync(dir), shadowBase, create) : null;
}

async function isIgnored(location: GitLocation, path: string): Promise<boolean | null> {
    try {
        await run('git', ['check-ignore', '--quiet', '--', path], { cwd: location.root, env: { ...process.env, ...location.env } });
        return true;
    }
    catch (error) {
        return (error as { code?: unknown }).code === 1 ? false : null;
    }
}

export async function projectFilePath(dir: string, path: string, shadowBase: string): Promise<string | null> {
    try {
        const location = await locateGit(dir, shadowBase, false);
        if (!location) {
            return null;
        }
        const target = realpathSync(resolve(location.root, path));
        const inside = relative(location.root, target);
        if (!target.startsWith(location.root + sep) || inside.split(sep)[0] === '.git') {
            return null;
        }
        return await isIgnored(location, inside) === false ? target : null;
    }
    catch {
        return null;
    }
}

export class WorkingTree {
    private readonly location: GitLocation;
    private readonly indexFile: string;

    private constructor(location: GitLocation, indexFile: string) {
        this.location = location;
        this.indexFile = indexFile;
    }

    static async open(dir: string, indexFile: string, shadowBase: string): Promise<WorkingTree | null> {
        try {
            const location = await locateGit(dir, shadowBase, true);
            if (!location) {
                return null;
            }
            mkdirSync(dirname(indexFile), { recursive: true });
            if (location.index) {
                rmSync(indexFile, { force: true });
                if (existsSync(location.index)) {
                    copyFileSync(location.index, indexFile);
                }
            }
            return new WorkingTree(location, indexFile);
        }
        catch {
            return null;
        }
    }

    async snapshot(): Promise<string> {
        await this.git(['add', '--all', '--', '.']);
        return (await this.git(['write-tree'])).trim();
    }

    get tracksCommits(): boolean {
        return this.location.index !== null;
    }

    async head(): Promise<string | null> {
        try {
            return (await this.git(['rev-parse', '--verify', '--quiet', 'HEAD'])).trim() || null;
        }
        catch {
            return null;
        }
    }

    async commitsSince(base: string | null): Promise<Omit<TurnCommit, 'order'>[]> {
        const range = base ? [`${base}..HEAD`] : ['HEAD'];
        const log = await this.git(['log', '--reverse', '--shortstat', `--max-count=${COMMIT_LIMIT}`, `--format=${RECORD}%H${FIELD}%s${FIELD}%b${FIELD}`, ...range]);
        return log.split(RECORD).map(entry => entry.trim()).filter(Boolean).map((entry) => {
            const [hash = '', title = '', body = '', stat = ''] = entry.split(FIELD);
            return { hash, title, body: body.trim(), ...commitStat(stat) };
        });
    }

    async changes(from: string, to: string): Promise<FileChange[]> {
        if (from === to) {
            return [];
        }
        return parsePatch(await this.git(['diff', '--no-color', '--no-ext-diff', '--find-renames', '--unified=3', from, to]));
    }

    private async git(args: string[]): Promise<string> {
        const { stdout } = await run('git', ['-c', 'core.quotePath=false', ...args], {
            cwd: this.location.root,
            env: { ...process.env, ...this.location.env, GIT_INDEX_FILE: this.indexFile },
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
    private changeOrder = new Map<string, number>();
    private changeCount = 0;
    private turnHead: string | null = null;
    private commits: TurnCommit[] = [];
    private readonly dir: string;
    private readonly indexFile: string;
    private readonly shadowBase: string;

    constructor(dir: string, indexFile: string, shadowBase: string) {
        this.dir = dir;
        this.indexFile = indexFile;
        this.shadowBase = shadowBase;
    }

    beginTurn(): void {
        this.tree = null;
        this.queue(async (tree) => {
            this.turnStart = await tree.snapshot();
            this.latest = this.turnStart;
            this.changeOrder.clear();
            this.commits = [];
            this.turnHead = tree.tracksCommits ? await tree.head() : null;
        });
    }

    afterStep(found: (turnChanges: TurnFileChanges) => void): void {
        this.queue(async (tree) => {
            const previous = this.latest;
            this.latest = await tree.snapshot();
            const step = previous ? await tree.changes(previous, this.latest) : [];
            for (const change of step) {
                this.changeOrder.set(change.path, ++this.changeCount);
            }
            const committed = await this.collectCommits(tree);
            if ((step.length > 0 || committed) && this.turnStart) {
                found(this.turnChanges(await tree.changes(this.turnStart, this.latest)));
            }
        });
    }

    endTurn(found: (turnChanges: TurnFileChanges) => void): void {
        this.queue(async (tree) => {
            const start = this.turnStart;
            this.turnStart = null;
            this.latest = await tree.snapshot();
            await this.collectCommits(tree);
            if (start) {
                found(this.turnChanges(await tree.changes(start, this.latest)));
            }
        });
    }

    private async collectCommits(tree: WorkingTree): Promise<boolean> {
        if (!tree.tracksCommits || !this.turnStart) {
            return false;
        }
        const known = new Set(this.commits.map(commit => commit.hash));
        const fresh = (await tree.commitsSince(this.turnHead)).filter(commit => !known.has(commit.hash));
        for (const commit of fresh) {
            this.commits.push({ ...commit, order: ++this.changeCount });
        }
        return fresh.length > 0;
    }

    private turnChanges(changes: FileChange[]): TurnFileChanges {
        const position = (change: FileChange) => this.changeOrder.get(change.path) ?? -1;
        const files = [...changes].sort((a, b) => position(a) - position(b)).map(change => ({ ...change, order: position(change) }));
        return { files, commits: [...this.commits] };
    }

    dispose(): void {
        this.work = this.work.then(() => rmSync(this.indexFile, { force: true }));
        this.tree = null;
        this.turnStart = null;
        this.latest = null;
    }

    private queue(step: (tree: WorkingTree) => Promise<void>): void {
        this.tree ??= WorkingTree.open(this.dir, this.indexFile, this.shadowBase);
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
