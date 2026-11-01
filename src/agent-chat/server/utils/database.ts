import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../database/schema';

let database: BetterSQLite3Database<typeof schema> | null = null;

function resolveMigrationsDir(): string {
  if (import.meta.dev) {
    return resolve(process.cwd(), 'server/database/migrations');
  }
  return join(dirname(process.argv[1] ?? ''), 'migrations');
}

export function useDatabase(): BetterSQLite3Database<typeof schema> {
  if (database) {
    return database;
  }
  const connection = new Database(join(resolveDataDir(), 'chat.sqlite'));
  connection.pragma('journal_mode = WAL');
  connection.pragma('foreign_keys = ON');
  database = drizzle(connection, { schema });
  migrate(database, { migrationsFolder: resolveMigrationsDir() });
  return database;
}
