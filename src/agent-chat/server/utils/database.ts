import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import * as schema from '../database/schema';

const DATABASE_FILE = 'chat.sqlite';
const BACKUPS_KEPT = 5;

let database: BetterSQLite3Database<typeof schema> | null = null;

function resolveMigrationsDir(): string {
    if (import.meta.dev) {
        return resolve(process.cwd(), 'server/database/migrations');
    }
    return join(dirname(process.argv[1] ?? ''), 'migrations');
}

function lastAppliedMigration(connection: Database.Database): number | null {
    const table = connection.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'`).get();
    if (!table) {
        return null;
    }
    const row = connection.prepare('SELECT MAX(created_at) AS last FROM __drizzle_migrations').get() as { last: number | null };
    return row.last;
}

function backupBeforeMigrating(connection: Database.Database, backupsDir: string): void {
    mkdirSync(backupsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    connection.exec(`VACUUM INTO '${join(backupsDir, `chat-${stamp}.sqlite`).replace(/'/g, `''`)}'`);
    const backups = readdirSync(backupsDir).filter(name => name.startsWith('chat-') && name.endsWith('.sqlite')).sort();
    for (const stale of backups.slice(0, Math.max(0, backups.length - BACKUPS_KEPT))) {
        rmSync(join(backupsDir, stale), { force: true });
    }
}

function prepareMigrations(connection: Database.Database, migrationsFolder: string, backupsDir: string): void {
    const known = readMigrationFiles({ migrationsFolder }).map(migration => migration.folderMillis);
    const newestKnown = Math.max(...known);
    const lastApplied = lastAppliedMigration(connection);
    if (lastApplied !== null && lastApplied > newestKnown) {
        throw new Error(`The chat database was written by a newer version of this app. Start that version, or restore a backup from ${backupsDir}.`);
    }
    if (lastApplied !== null && known.some(created => created > lastApplied)) {
        backupBeforeMigrating(connection, backupsDir);
    }
}

export function useDatabase(): BetterSQLite3Database<typeof schema> {
    if (database) {
        return database;
    }
    const dataDir = resolveDataDir();
    const path = join(dataDir, DATABASE_FILE);
    const existed = existsSync(path);
    const connection = new Database(path);
    connection.pragma('journal_mode = WAL');
    connection.pragma('foreign_keys = ON');
    const migrationsFolder = resolveMigrationsDir();
    if (existed) {
        prepareMigrations(connection, migrationsFolder, join(dataDir, 'backups'));
    }
    const instance = drizzle(connection, { schema });
    migrate(instance, { migrationsFolder });
    database = instance;
    return database;
}
