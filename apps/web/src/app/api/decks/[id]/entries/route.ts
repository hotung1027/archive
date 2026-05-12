import { NextRequest, NextResponse } from 'next/server';
import { db } from '@omnisearch/db';
import { decks, deckEntries, cards } from '@omnisearch/db';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// GET /api/decks/:id/entries — list all entries with card data
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const deckId = parseInt(id, 10);

  const rows = await db
    .select({
      entryId:  deckEntries.id,
      quantity: deckEntries.quantity,
      card:     cards,
    })
    .from(deckEntries)
    .innerJoin(cards, eq(deckEntries.cardSlug, cards.slug))
    .where(eq(deckEntries.deckId, deckId));

  return NextResponse.json({ data: rows });
}

// POST /api/decks/:id/entries — add or increment a card
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const deckId = parseInt(id, 10);
  const body   = await req.json() as { cardSlug: string; quantity?: number };

  if (!body.cardSlug) {
    return NextResponse.json({ error: 'cardSlug is required' }, { status: 400 });
  }

  // Upsert: increment quantity if already present
  await db
    .insert(deckEntries)
    .values({
      deckId,
      cardSlug: body.cardSlug,
      quantity: body.quantity ?? 1,
    })
    .onConflictDoUpdate({
      target:  [deckEntries.deckId, deckEntries.cardSlug],
      set: {
        quantity: sql`${deckEntries.quantity} + ${body.quantity ?? 1}`,
      },
    });

  // Also bump deck updatedAt
  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId));

  return NextResponse.json({ ok: true });
}

// DELETE /api/decks/:id/entries — remove or decrement a card
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id }      = await params;
  const deckId      = parseInt(id, 10);
  const { cardSlug, removeAll } = await req.json() as {
    cardSlug: string;
    removeAll?: boolean;
  };

  if (!cardSlug) {
    return NextResponse.json({ error: 'cardSlug is required' }, { status: 400 });
  }

  if (removeAll) {
    await db.delete(deckEntries).where(
      and(eq(deckEntries.deckId, deckId), eq(deckEntries.cardSlug, cardSlug))
    );
  } else {
    // Decrement; delete row if quantity reaches 0
    await db.run(sql`
      UPDATE deck_entries
      SET quantity = quantity - 1
      WHERE deck_id = ${deckId} AND card_slug = ${cardSlug};

      DELETE FROM deck_entries
      WHERE deck_id = ${deckId} AND card_slug = ${cardSlug} AND quantity <= 0;
    `);
  }

  await db.update(decks).set({ updatedAt: new Date() }).where(eq(decks.id, deckId));

  return NextResponse.json({ ok: true });
}
