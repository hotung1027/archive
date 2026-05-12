import { NextRequest, NextResponse } from 'next/server';
import { db } from '@omnisearch/db';
import { cards } from '@omnisearch/db';
import { eq, desc, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

/**
 * GET /api/editions?name=<cardName>
 *
 * Returns all editions/printings for a given card name, sorted newest first.
 * Used by CardDetails to populate the edition art picker.
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name');

  if (!name) {
    return NextResponse.json({ error: 'Missing required query param: name' }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(cards)
    .where(eq(cards.name, name))
    .orderBy(desc(cards.releaseDate), asc(cards.slug));

  return NextResponse.json({ data: rows });
}
