import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function boxKey(signingKey: string): Buffer {
    return createHash('sha256').update(`chat-secret:${signingKey}`).digest();
}

export function sealSecret(signingKey: string, secret: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, boxKey(signingKey), iv);
    const sealed = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return [iv, cipher.getAuthTag(), sealed].map(part => part.toString('base64url')).join('.');
}

export function openSecret(signingKey: string, box: string): string | null {
    const [iv, tag, sealed] = box.split('.').map(part => Buffer.from(part, 'base64url'));
    if (!iv || !tag || !sealed) {
        return null;
    }
    try {
        const decipher = createDecipheriv(ALGORITHM, boxKey(signingKey), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(sealed), decipher.final()]).toString('utf8');
    }
    catch {
        return null;
    }
}
