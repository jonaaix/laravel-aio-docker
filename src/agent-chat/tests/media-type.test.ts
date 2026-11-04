import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectedMediaType } from '../server/utils/conversation-files.ts';

test('a file of unknown type is text when its content is', () => {
    const dir = mkdtempSync(join(tmpdir(), 'media-type-'));
    const write = (name: string, content: string | Buffer) => {
        writeFileSync(join(dir, name), content);
        return join(dir, name);
    };
    assert.equal(detectedMediaType(write('main.rs', 'fn main() { println!("Grüße"); }\n'), 'main.rs'), 'text/plain');
    assert.equal(detectedMediaType(write('Makefile', 'all:\n\techo hi\n'), 'Makefile'), 'text/plain');
    assert.equal(detectedMediaType(write('blob.bin', Buffer.from([0x89, 0x00, 0x01, 0x02])), 'blob.bin'), 'application/octet-stream');
    assert.equal(detectedMediaType(write('latin.dat', Buffer.from([0x66, 0xe4, 0x72])), 'latin.dat'), 'application/octet-stream');
    assert.equal(detectedMediaType(write('photo.png', 'not really a png'), 'photo.png'), 'image/png');
    rmSync(dir, { recursive: true, force: true });
});
