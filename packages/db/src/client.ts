import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

// Fall back to workspace-root data/ when DATABASE_URL is not set.
// import.meta.dir is packages/db/src, so ../../../ is the workspace root.
const sourceDir = typeof import.meta.dir === 'string' ? import.meta.dir : undefined;
const workspaceRoot = sourceDir ? resolve(sourceDir, '../../..') : resolve(process.cwd(), '../..');
const DB_PATH = process.env.DATABASE_URL
  ?? resolve(workspaceRoot, 'data/omnisearch.db');

// Ensure the directory exists (SQLite cannot create missing parent dirs)
mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH, { create: true });
// Enable WAL mode for better concurrent read performance
sqlite.run('PRAGMA journal_mode = WAL;');
sqlite.run('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
export { sqlite };
export type DB = typeof db;
