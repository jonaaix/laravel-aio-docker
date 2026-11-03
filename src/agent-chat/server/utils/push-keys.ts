import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import webpush from 'web-push';

export interface VapidDetails {
    subject: string;
    publicKey: string;
    privateKey: string;
}

const KEY_FILE = 'vapid.json';
const DEFAULT_SUBJECT = 'mailto:agent-chat@localhost.localdomain';

let cached: VapidDetails | null = null;

function storedKeys(): Pick<VapidDetails, 'publicKey' | 'privateKey'> {
    const file = join(resolveDataDir(), KEY_FILE);
    if (existsSync(file)) {
        return JSON.parse(readFileSync(file, 'utf8'));
    }
    const generated = webpush.generateVAPIDKeys();
    writeFileSync(file, JSON.stringify(generated), { mode: 0o600 });
    return generated;
}

export function vapidDetails(): VapidDetails {
    if (!cached) {
        const config = useRuntimeConfig();
        if (!config.vapidPublicKey !== !config.vapidPrivateKey) {
            throw new Error('Set both NUXT_VAPID_PUBLIC_KEY and NUXT_VAPID_PRIVATE_KEY, or neither.');
        }
        const keys = config.vapidPublicKey && config.vapidPrivateKey
            ? { publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey }
            : storedKeys();
        cached = { subject: config.vapidSubject || DEFAULT_SUBJECT, ...keys };
    }
    return cached;
}
