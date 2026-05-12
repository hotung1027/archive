#!/usr/bin/env bun
/**
 * scripts/fetch-cards.ts
 *
 * Crawls the Grand Archive Index API and upserts all cards into SQLite.
 *
 * Usage:
 *   bun scripts/fetch-cards.ts              # full crawl
 *   bun scripts/fetch-cards.ts --dry-run    # fetch only, no DB write
 *   bun scripts/fetch-cards.ts --page 3     # resume from page 3
 *   bun scripts/fetch-cards.ts --with-details # enrich via /cards/{slug}
 *
 * Rate-limiting: 300 ms delay between pages to be a polite crawler.
 */

import { db } from '../packages/db/src/client';
import { cards } from '../packages/db/src/schema';

// ─── Config ───────────────────────────────────────────────────────────────────
const API_BASE_URL = 'https://api.gatcg.com';
const SEARCH_URL   = `${API_BASE_URL}/cards/search`;
const DEFINITIONS_URL = `${API_BASE_URL}/option/search`;
const CARD_URL     = `${API_BASE_URL}/cards`;
const IMAGE_URL    = `${API_BASE_URL}/cards/images`;
const PAGE_SIZE  = 50;
const DELAY_MS   = 300;  // polite delay between requests
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const isDryRun   = process.argv.includes('--dry-run');
const showSchema = process.argv.includes('--schema');
const withDetails = process.argv.includes('--with-details') || process.argv.includes('--details');
const startPage  = (() => {
  const idx = process.argv.indexOf('--page');
  return idx !== -1 ? parseInt(process.argv[idx + 1], 10) : 1;
})();

// ─── GA API response types ────────────────────────────────────────────────────
// The GA /cards/search endpoint returns one object per unique card name.
// Each card has an `editions` array — one entry per set printing.
// Each edition has its own slug (the per-printing unique key), rarity,
// collector_number, set info, image_url, etc.
//
// Card shape (abbreviated):
//   { slug, uuid, name, elements[], classes[], types[], subtypes[],
//     cost_memory, cost_reserve, level, life, power, durability,
//     effect, flavor, editions: [ { slug, rarity, collector_number,
//       language, image_url, illustrator, released_at?,
//       set: { abbreviation, name } }, ... ] }

interface GaEditionSet {
  abbreviation?: string;
  prefix?:       string;
  name:          string;
  language?:     string;
  release_date?: string | null;
}

interface GaEdition {
  slug:              string;
  rarity?:           string | number;
  collector_number?: string;
  language?:         string;
  released_at?:      string | null;
  release_date?:     string | null;
  image_url?:        string;
  image?:            string;
  illustrator?:      string | null;
  effect?:           string | null;
  flavor?:           string | null;
  set?:              GaEditionSet;
}

interface GaOption {
  value:   string | number;
  text?:   string;
  display?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GaCard = Record<string, any> & {
  uuid:      string;
  name:      string;
  slug:      string;
  editions?: GaEdition[];
  result_editions?: GaEdition[];
};

interface GaDefinitions {
  set?:     GaOption[];
  rarity?:  GaOption[];
  element?: GaOption[];
  class?:   GaOption[];
  type?:    GaOption[];
  subtype?: GaOption[];
}

interface GaApiResponse {
  data:  GaCard[];
  meta?: {
    current_page: number;
    last_page:    number;
    total:        number;
    per_page:     number;
  };
  current_page?: number;
  last_page?:    number;
  total?:        number;
  page?:         number;
  page_size?:    number;
  total_cards?:  number;
  total_pages?:  number;
  paginated_cards_count?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * SQLite bindings reject `undefined`; replace every undefined value with null
 * so we don't have to exhaustively guard every optional API field.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitize<T extends Record<string, any>>(row: T): T {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v === undefined ? null : v]),
  ) as T;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeImageUrl(image?: string | null) {
  if (!image) return '';
  const trimmed = image.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/cards/images/')) return `${API_BASE_URL}${trimmed}`;
  if (trimmed.startsWith('cards/images/')) return `${API_BASE_URL}/${trimmed}`;
  if (/^[^/]+\.(?:jpe?g|png|webp)$/i.test(trimmed)) return `${IMAGE_URL}/${trimmed}`;
  if (trimmed.startsWith('/')) return `${API_BASE_URL}${trimmed}`;
  return `${API_BASE_URL}/${trimmed}`;
}

function normalizeToken(value: unknown) {
  return String(value)
    .toLowerCase()
    .split(/([\s_-]+)/)
    .map(part => /^[a-z]/.test(part) ? part[0].toUpperCase() + part.slice(1) : part)
    .join('');
}

function toNullableInteger(value: unknown) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function costValue(card: GaCard, type: 'reserve' | 'memory') {
  const direct = type === 'reserve' ? card.cost_reserve : card.cost_memory;
  if (direct != null) return toNullableInteger(direct);
  if (card.cost && typeof card.cost === 'object' && card.cost.type === type) {
    return toNullableInteger(card.cost.value);
  }
  return null;
}

function optionText(definitions: GaDefinitions, field: keyof GaDefinitions, value: unknown) {
  const normalizedValue = String(value ?? '');
  const option = definitions[field]?.find(item => String(item.value).toLowerCase() === normalizedValue.toLowerCase());
  return option?.display ?? option?.text ?? normalizeToken(value);
}

function normalizeStringArrayWithDefinitions(definitions: GaDefinitions, field: keyof GaDefinitions, value: unknown) {
  if (Array.isArray(value)) return value.map(item => optionText(definitions, field, item)).filter(Boolean);
  return value == null || value === '' ? [] : [optionText(definitions, field, value)];
}

async function fetchJson<T>(url: string, label: string): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'OmniSearch-DeckBuilder/1.0 (personal project; non-commercial)',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      }

      return await res.json() as T;
    } catch (err) {
      lastError = err as Error;
      console.warn(`  ⚠ ${label} attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`);
      if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw new Error(`Failed to fetch ${label} after ${MAX_RETRIES} attempts: ${lastError?.message}`);
}

async function fetchDefinitions(): Promise<GaDefinitions> {
  return fetchJson<GaDefinitions>(DEFINITIONS_URL, 'definitions');
}

async function fetchPage(page: number): Promise<GaApiResponse> {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(PAGE_SIZE),
  });

  if (!withDetails) {
    params.set('separate_editions', 'true');
  }

  return fetchJson<GaApiResponse>(`${SEARCH_URL}?${params}`, `page ${page}`);
}

async function fetchCardDetails(slug: string): Promise<GaCard | null> {
  try {
    return await fetchJson<GaCard>(`${CARD_URL}/${encodeURIComponent(slug)}`, `card ${slug}`);
  } catch (err) {
    console.warn(`  ⚠ Detail lookup failed for slug="${slug}": ${(err as Error).message}`);
    return null;
  }
}

function getCardEditions(card: GaCard) {
  const primary = !withDetails && Array.isArray(card.result_editions) && card.result_editions.length > 0
    ? card.result_editions
    : card.editions;

  const editions: GaEdition[] = Array.isArray(primary) ? primary : [];
  const bySlug = new Map<string, GaEdition>();

  for (const edition of editions) {
    if (edition.slug) bySlug.set(edition.slug, edition);
  }

  return [...bySlug.values()];
}

/**
 * Expands one card (which may have multiple printings) into one DB row
 * per edition. Uses the edition's slug as the primary key so each
 * printing of "Nameless Champion" gets its own row.
 */
function mapCardToRows(card: GaCard, definitions: GaDefinitions) {
  const editions = getCardEditions(card);

  // Shared base fields (same across all editions of this card)
  const base = {
    uuid:        card.uuid,
    name:        card.name,
    elements:    JSON.stringify(normalizeStringArrayWithDefinitions(definitions, 'element', card.elements ?? card.element)),
    classes:     JSON.stringify(normalizeStringArrayWithDefinitions(definitions, 'class', card.classes)),
    type:        optionText(definitions, 'type', (Array.isArray(card.types) ? card.types[0] : card.type) ?? 'Unknown'),
    subtypes:    JSON.stringify(normalizeStringArrayWithDefinitions(definitions, 'subtype', card.subtypes)),
    reserveCost: costValue(card, 'reserve'),
    memoryCost:  costValue(card, 'memory'),
    level:       toNullableInteger(card.level),
    life:        toNullableInteger(card.life),
    power:       toNullableInteger(card.power),
    durability:  toNullableInteger(card.durability),
    effectText:  card.effect       ?? card.effect_text   ?? null,
    flavorText:  card.flavor       ?? card.flavor_text   ?? null,
  };

  if (editions.length === 0) {
    // No editions array — fall back to using the base card slug
    console.warn(`  ⚠ No editions for slug "${card.slug}" — storing as single row`);
    return [sanitize({
      ...base,
      slug:            card.slug,
      setCode:         '',
      setName:         '',
      collectorNumber: '',
      language:        'en',
      releaseDate:     null,
      rarity:          '',
      imageUrl:        normalizeImageUrl(card.image_url ?? card.image),
      illustrator:     card.illustrator ?? null,
      cardJson:        JSON.stringify(card),
      editionJson:     '{}',
    })];
  }

  return editions.map(ed => {
    const setCode = ed.set?.abbreviation ?? ed.set?.prefix ?? '';
    const setName = ed.set?.name ?? '';

    if (!setCode) {
      console.warn(`  ⚠ No setCode for edition slug "${ed.slug}" of card "${card.name}"`);
    }

    return sanitize({
      ...base,
      effectText:      ed.effect ?? base.effectText,
      flavorText:      ed.flavor ?? base.flavorText,
      slug:            ed.slug,
      setCode,
      setName,
      collectorNumber: ed.collector_number ?? '',
      language:        (ed.language ?? ed.set?.language ?? 'en').toLowerCase(),
      releaseDate:     ed.released_at ?? ed.release_date ?? ed.set?.release_date ?? null,
      rarity:          optionText(definitions, 'rarity', ed.rarity ?? ''),
      imageUrl:        normalizeImageUrl(ed.image_url ?? ed.image ?? card.image_url ?? card.image),
      illustrator:     ed.illustrator      ?? null,
      cardJson:        JSON.stringify(card),
      editionJson:     JSON.stringify(ed),
    });
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🃏 Grand Archive card crawler starting...');
  if (isDryRun) console.log('  (DRY RUN — no DB writes)');
  if (withDetails) console.log('  (Detail enrichment enabled — calling /cards/{slug})');

  console.log('\nFetching option definitions...');
  const definitions = await fetchDefinitions();
  console.log(`  Known sets: ${definitions.set?.length ?? 0}, rarity mappings: ${definitions.rarity?.length ?? 0}`);

  // Fetch first page to discover total pages
  console.log(`\nFetching page ${startPage}...`);
  const first = await fetchPage(startPage);

  const lastPage = first.meta?.last_page ?? first.last_page ?? first.total_pages ?? 1;
  const total = first.meta?.total
    ?? first.total
    ?? first.total_cards
    ?? first.paginated_cards_count
    ?? first.data.length;

  console.log(`  Total cards: ${total} across ${lastPage} pages\n`);

  // --schema: print the raw first card and exit so we can verify the API shape
  if (showSchema) {
    console.log('── Raw first card (--schema mode) ──────────────────────────');
    console.log(JSON.stringify(first.data[0], null, 2));
    console.log('── Mapped rows ─────────────────────────────────────────────');
    console.log(JSON.stringify(mapCardToRows(first.data[0], definitions), null, 2));
    console.log('── End ─────────────────────────────────────────────────────');
    console.log('Re-run without --schema to begin the full crawl.');
    process.exit(0);
  }

  let inserted = 0;
  let skipped  = 0;
  const detailCache = new Map<string, Promise<GaCard | null>>();

  async function cardForWrite(card: GaCard) {
    if (!withDetails) return card;
    if (!detailCache.has(card.slug)) {
      detailCache.set(card.slug, fetchCardDetails(card.slug));
    }
    return await detailCache.get(card.slug)! ?? card;
  }

  const processPage = async (response: GaApiResponse) => {
    if (isDryRun) {
      const total = response.data.reduce((n, c) => n + (getCardEditions(c).length || 1), 0);
      console.log(`  [dry-run] Would upsert ~${total} edition rows from ${response.data.length} cards`);
      return;
    }

    for (const card of response.data) {
      const rows = mapCardToRows(await cardForWrite(card), definitions);
      for (const row of rows) {
        try {
          // Exclude the PK (slug) from the conflict-update set — drizzle
          // rejects updating primary key columns in onConflictDoUpdate.
          const { slug, ...updateFields } = row;
          db.insert(cards)
            .values(row)
            .onConflictDoUpdate({ target: cards.slug, set: updateFields })
            .run();
          inserted++;
        } catch (err) {
          console.warn(`  ⚠ Failed to upsert slug="${row.slug}" name="${row.name}": ${(err as Error).message}`);
          skipped++;
        }
      }
    }
  };

  // Process first page
  await processPage(first);
  console.log(`Page ${startPage}/${lastPage} — ${first.data.length} cards ✓`);

  // Fetch remaining pages sequentially with polite delay
  for (let page = startPage + 1; page <= lastPage; page++) {
    await sleep(DELAY_MS);
    const response = await fetchPage(page);
    await processPage(response);
    console.log(`Page ${page}/${lastPage} — ${response.data.length} cards ✓`);
  }

  console.log(`\n✅ Done. Upserted: ${inserted}, Skipped: ${skipped}`);
}

main().catch(err => {
  console.error('❌ Crawler failed:', err);
  process.exit(1);
});
