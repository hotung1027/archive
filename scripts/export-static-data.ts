#!/usr/bin/env bun

import { mkdir, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { asc } from 'drizzle-orm';
import { db, sqlite, cards } from '../packages/db/src/index';

const outputPath = resolve(import.meta.dir, '../apps/web/public/data/cards.json');

const rows = await db
  .select()
  .from(cards)
  .orderBy(asc(cards.name), asc(cards.slug));

await mkdir(resolve(outputPath, '..'), { recursive: true });
await writeFile(outputPath, JSON.stringify(rows), 'utf8');

console.log(`Exported ${rows.length} card printings to ${outputPath}`);
sqlite.close();