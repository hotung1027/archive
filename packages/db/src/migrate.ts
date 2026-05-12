import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { resolve } from 'path';
import { db, sqlite } from './client';

const migrationsFolder = resolve(import.meta.dir, '../migrations');

console.log('Running migrations...');
migrate(db, { migrationsFolder });
console.log('Migrations complete.');
sqlite.close();
