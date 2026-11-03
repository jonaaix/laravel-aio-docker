import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { devices } from '../database/schema';
import type { PairedDevice } from '../../shared/types/device';
import type { DevicePublicKey } from './device-auth';

export type DeviceRow = typeof devices.$inferSelect;

const LAST_SEEN_PRECISION_MS = 60 * 1000;
const LABEL_LENGTH = 60;

export function createDevice(userId: string, publicKey: DevicePublicKey, label: string): DeviceRow {
    const now = Date.now();
    const row: DeviceRow = { id: randomUUID(), userId, label: label.trim().slice(0, LABEL_LENGTH) || 'Device', publicKey: JSON.stringify(publicKey), createdAt: now, lastSeenAt: now };
    useDatabase().insert(devices).values(row).run();
    return row;
}

export function findDevice(id: unknown): DeviceRow | null {
    return typeof id === 'string' && id ? useDatabase().select().from(devices).where(eq(devices.id, id)).get() ?? null : null;
}

export function devicePublicKey(row: DeviceRow): DevicePublicKey {
    return JSON.parse(row.publicKey) as DevicePublicKey;
}

export function listDevices(userId: string): PairedDevice[] {
    return useDatabase().select().from(devices).where(eq(devices.userId, userId)).orderBy(desc(devices.lastSeenAt)).all()
        .map(row => ({ id: row.id, label: row.label, createdAt: row.createdAt, lastSeenAt: row.lastSeenAt }));
}

export function deleteDevice(id: string, userId: string): boolean {
    return useDatabase().delete(devices).where(and(eq(devices.id, id), eq(devices.userId, userId))).run().changes > 0;
}

export function touchDevice(row: DeviceRow, now = Date.now()): void {
    if (now - row.lastSeenAt >= LAST_SEEN_PRECISION_MS) {
        useDatabase().update(devices).set({ lastSeenAt: now }).where(eq(devices.id, row.id)).run();
    }
}
