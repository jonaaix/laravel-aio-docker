import { eq } from 'drizzle-orm';
import { settings } from '../database/schema';
import { isSpeechProvider, type SpeechProvider } from '../../shared/utils/speech';

const PROVIDER_SETTING = 'speech.provider';
const KEY_SETTING = 'speech.apiKey';

export interface SpeechService {
    provider: SpeechProvider;
    apiKey: string;
}

function readSetting(key: string): string | null {
    return useDatabase().select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

function writeSetting(key: string, value: string): void {
    const row = { key, value, updatedAt: Date.now() };
    useDatabase().insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: { value: row.value, updatedAt: row.updatedAt } }).run();
}

export function speechService(): SpeechService | null {
    const provider = readSetting(PROVIDER_SETTING);
    const box = readSetting(KEY_SETTING);
    const apiKey = box ? openSecret(chatKey(), box) : null;
    return isSpeechProvider(provider) && apiKey ? { provider, apiKey } : null;
}

export function storeSpeechService(service: SpeechService): void {
    writeSetting(PROVIDER_SETTING, service.provider);
    writeSetting(KEY_SETTING, sealSecret(chatKey(), service.apiKey));
}

export function removeSpeechService(): void {
    useDatabase().delete(settings).where(eq(settings.key, KEY_SETTING)).run();
    useDatabase().delete(settings).where(eq(settings.key, PROVIDER_SETTING)).run();
}
