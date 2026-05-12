import { NextRequest, NextResponse } from 'next/server';
import { db } from '@omnisearch/db';
import { cards } from '@omnisearch/db';
import { sql, like, and, or, not, gte, lte, eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const name       = searchParams.get('name');
  const text       = searchParams.get('text');       // searches name + effectText
  const elements   = searchParams.getAll('element'); // can be multi
  const classes    = searchParams.getAll('class');
  const types      = searchParams.getAll('type');
  const notTypes   = searchParams.getAll('notType');
  const subtypes   = searchParams.getAll('subtype');
  const notSubtypes = searchParams.getAll('notSubtype');
  const elementMode = searchParams.get('elementMode') === 'AND' ? 'AND' : 'OR';
  const classMode   = searchParams.get('classMode') === 'AND' ? 'AND' : 'OR';
  const typeMode    = searchParams.get('typeMode') === 'AND' ? 'AND' : 'OR';
  const subtypeMode = searchParams.get('subtypeMode') === 'AND' ? 'AND' : 'OR';
  const costMin    = searchParams.get('costMin');
  const costMax    = searchParams.get('costMax');
  const setCode    = searchParams.get('setCode');
  const page       = parseInt(searchParams.get('page') ?? '1', 10);
  const pageSize   = Math.min(parseInt(searchParams.get('pageSize') ?? '60', 10), 200);

  const conditions: ReturnType<typeof sql>[] = [];

  if (name) {
    conditions.push(like(cards.name, `%${name}%`));
  }

  if (text) {
    conditions.push(
      or(
        like(cards.name, `%${text}%`),
        like(cards.effectText, `%${text}%`)
      )!
    );
  }

  // JSON array contains checks — SQLite json_each approach
  if (elements.length > 0) {
    // Card elements JSON array must contain at least one of the requested elements
    const elementChecks = elements.map(el =>
      sql`EXISTS (
        SELECT 1 FROM json_each(${cards.elements}) 
        WHERE value = ${el}
      )`
    );
    conditions.push(elementMode === 'AND' ? and(...elementChecks)! : or(...elementChecks)!);
  }

  if (classes.length > 0) {
    const classChecks = classes.map(c =>
      sql`EXISTS (
        SELECT 1 FROM json_each(${cards.classes}) 
        WHERE value = ${c}
      )`
    );
    conditions.push(classMode === 'AND' ? and(...classChecks)! : or(...classChecks)!);
  }

  if (types.length > 0) {
    const typeChecks = types.map(type => eq(cards.type, type));
    conditions.push(typeMode === 'AND' ? and(...typeChecks)! : inArray(cards.type, types));
  }

  if (notTypes.length > 0) {
    conditions.push(not(inArray(cards.type, notTypes)));
  }

  if (subtypes.length > 0) {
    const subtypeChecks = subtypes.map(s =>
      sql`EXISTS (SELECT 1 FROM json_each(${cards.subtypes}) WHERE value = ${s})`
    );
    conditions.push(subtypeMode === 'AND' ? and(...subtypeChecks)! : or(...subtypeChecks)!);
  }

  if (notSubtypes.length > 0) {
    const notChecks = notSubtypes.map(s =>
      sql`NOT EXISTS (SELECT 1 FROM json_each(${cards.subtypes}) WHERE value = ${s})`
    );
    conditions.push(and(...notChecks)!);
  }

  if (costMin) {
    conditions.push(gte(cards.reserveCost, parseInt(costMin, 10)));
  }

  if (costMax) {
    conditions.push(lte(cards.reserveCost, parseInt(costMax, 10)));
  }

  if (setCode) {
    conditions.push(eq(cards.setCode, setCode));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * pageSize;

  // ── Grouped mode: one canonical row per unique card name ──────────────────
  if (searchParams.get('grouped') === 'true') {
    // Step 1: get distinct names with the MIN(slug) as canonical slug, paginated
    const nameRows = await db
      .select({
        name:          cards.name,
        canonicalSlug: sql<string>`MIN(${cards.slug})`,
      })
      .from(cards)
      .where(where)
      .groupBy(cards.name)
      .orderBy(
        text
          ? sql`CASE WHEN ${cards.name} LIKE ${'%' + text + '%'} THEN 0 ELSE 1 END, ${cards.name}`
          : cards.name
      )
      .limit(pageSize)
      .offset(offset);

    const slugs = nameRows.map(r => r.canonicalSlug);

    const [rows, countRow] = await Promise.all([
      slugs.length > 0
        ? db.select().from(cards).where(inArray(cards.slug, slugs))
        : Promise.resolve([]),
      db.select({ count: sql<number>`COUNT(DISTINCT ${cards.name})` }).from(cards).where(where),
    ]);

    // Restore the order from nameRows (SQL IN loses order)
    const rowBySlug = new Map(rows.map(r => [r.slug, r]));
    const orderedRows = nameRows.map(n => rowBySlug.get(n.canonicalSlug)).filter(Boolean);

    const total = countRow[0]?.count ?? 0;
    return NextResponse.json({
      data:  orderedRows,
      meta:  { total, page, pageSize, lastPage: Math.ceil(total / pageSize) },
    });
  }

  // ── Default mode: one row per edition ────────────────────────────────────
  const [rows, countRow] = await Promise.all([
    db.select().from(cards).where(where)
      .limit(pageSize)
      .offset(offset)
      .orderBy(cards.name),
    db.select({ count: sql<number>`count(*)` }).from(cards).where(where),
  ]);

  return NextResponse.json({
    data: rows,
    meta: {
      total:       countRow[0]?.count ?? 0,
      page,
      pageSize,
      lastPage:    Math.ceil((countRow[0]?.count ?? 0) / pageSize),
    },
  });
}
