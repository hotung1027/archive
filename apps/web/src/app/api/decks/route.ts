import { NextRequest, NextResponse } from 'next/server';
import { db } from '@omnisearch/db';
import { decks, deckEntries, cards } from '@omnisearch/db';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await db.select().from(decks).orderBy(decks.updatedAt);
  return NextResponse.json({ data: rows });
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { name: string; format?: string };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  const [deck] = await db.insert(decks).values({
    name:   body.name.trim(),
    format: body.format ?? 'standard',
  }).returning();

  return NextResponse.json({ data: deck }, { status: 201 });
}
