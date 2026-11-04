import { eq } from 'drizzle-orm';
import { settings } from '../database/schema';

export function readSetting(key: string): string | null {
    return useDatabase().select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function writeSetting(key: string, value: string): void {
    const row = { key, value, updatedAt: Date.now() };
    useDatabase().insert(settings).values(row).onConflictDoUpdate({ target: settings.key, set: { value: row.value, updatedAt: row.updatedAt } }).run();
}

export function removeSetting(key: string): void {
    useDatabase().delete(settings).where(eq(settings.key, key)).run();
}
