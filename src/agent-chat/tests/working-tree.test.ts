import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkingTree, parsePatch } from '../server/utils/working-tree.ts';

function repository(): string {
    const dir = mkdtempSync(join(tmpdir(), 'working-tree-'));
    const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'Test');
    writeFileSync(join(dir, 'app.php'), 'one\ntwo\nthree\n');
    writeFileSync(join(dir, 'old.txt'), 'gone\n');
    writeFileSync(join(dir, '.gitignore'), 'vendor/\n');
    git('add', '-A');
    git('commit', '-qm', 'start');
    return dir;
}

test('changes made outside any file tool are found, the real index stays untouched', async () => {
    const dir = repository();
    const indexBefore = readFileSync(join(dir, '.git', 'index'));
    const tree = await WorkingTree.open(dir, join(dir, '..', `${Date.now()}.index`));
    assert.ok(tree);
    const before = await tree.snapshot();
    execFileSync('sed', ['-i.bak', 's/two/TWO/', 'app.php'], { cwd: dir });
    rmSync(join(dir, 'app.php.bak'));
    writeFileSync(join(dir, 'new.txt'), 'hello\n');
    rmSync(join(dir, 'old.txt'));
    execFileSync('mkdir', ['-p', 'vendor'], { cwd: dir });
    writeFileSync(join(dir, 'vendor', 'ignored.php'), 'x\n');
    const after = await tree.snapshot();
    const changes = await tree.changes(before, after);
    assert.deepEqual(changes.map(change => [change.path, change.status, change.added, change.removed]), [
        ['app.php', 'modified', 1, 1],
        ['new.txt', 'added', 1, 0],
        ['old.txt', 'deleted', 0, 1],
    ]);
    assert.ok(changes[0]!.lines.includes('-two') && changes[0]!.lines.includes('+TWO'));
    assert.deepEqual(readFileSync(join(dir, '.git', 'index')), indexBefore);
    assert.deepEqual(await tree.changes(after, await tree.snapshot()), []);
    rmSync(dir, { recursive: true, force: true });
});

test('a folder outside git has no working tree', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'no-git-'));
    assert.equal(await WorkingTree.open(dir, join(dir, 'index')), null);
    rmSync(dir, { recursive: true, force: true });
});

test('a renamed file keeps its previous path', () => {
    const [change] = parsePatch('diff --git a/a.txt b/b.txt\nsimilarity index 100%\nrename from a.txt\nrename to b.txt\n');
    assert.deepEqual([change!.path, change!.previousPath, change!.status], ['b.txt', 'a.txt', 'renamed']);
});
