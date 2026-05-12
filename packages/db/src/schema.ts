import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ─────────────────────────────────────────────────────────────────
// cards
// Seeded from GA Index API. NOT unique on `name` — same card can
// appear in multiple releases. The PRIMARY KEY is `slug` which
// encodes set code + collector number + rarity, making it unique
// per printing.
// ─────────────────────────────────────────────────────────────────
export const cards = sqliteTable('cards', {
  // Identity
  slug:            text('slug').primaryKey(),          // unique per printing
  uuid:            text('uuid').notNull(),             // GA API id
  name:            text('name').notNull(),             // NOT unique — same name, different release

  // ── IMPORTANT: Release / printing ──────────────────────────────
  // Cards with identical names can be printed in different sets.
  // Always store setCode + collectorNumber alongside name.
  setCode:         text('set_code').notNull(),         // e.g. "AMBDP"
  setName:         text('set_name').notNull(),         // e.g. "Mortal Ambition Draft Pack"
  collectorNumber: text('collector_number').notNull(), // e.g. "EN-001"
  language:        text('language').notNull().default('en'),
  releaseDate:     text('release_date'),               // ISO 8601 or null
  rarity:          text('rarity').notNull(),           // C | U | R | SR | PR ...

  // Classification (stored as JSON arrays serialised to text)
  elements:        text('elements').notNull().default('[]'),   // JSON: string[]
  classes:         text('classes').notNull().default('[]'),    // JSON: string[]
  type:            text('type').notNull(),
  subtypes:        text('subtypes').notNull().default('[]'),   // JSON: string[]

  // Stats
  reserveCost:     integer('reserve_cost'),
  memoryCost:      integer('memory_cost'),
  level:           integer('level'),
  life:            integer('life'),
  power:           integer('power'),
  durability:      integer('durability'),

  // Text
  effectText:      text('effect_text'),
  flavorText:      text('flavor_text'),

  // Visuals
  imageUrl:        text('image_url').notNull().default(''),
  illustrator:     text('illustrator'),

  // Raw GA payloads preserve fields that are not normalized yet.
  cardJson:        text('card_json').notNull().default('{}'),
  editionJson:     text('edition_json').notNull().default('{}'),
});

// ─────────────────────────────────────────────────────────────────
// decks
// ─────────────────────────────────────────────────────────────────
export const decks = sqliteTable('decks', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  name:      text('name').notNull(),
  format:    text('format').notNull().default('standard'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// ─────────────────────────────────────────────────────────────────
// deck_entries
// References cards.slug (not name) so the specific printing is
// preserved in the decklist.
// ─────────────────────────────────────────────────────────────────
export const deckEntries = sqliteTable('deck_entries', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  deckId:      integer('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
  cardSlug:    text('card_slug').notNull().references(() => cards.slug, { onDelete: 'cascade' }),
  quantity:    integer('quantity').notNull().default(1),
});
