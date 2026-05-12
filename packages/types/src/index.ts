// ─────────────────────────────────────────────
// Card
// ─────────────────────────────────────────────

/**
 * IMPORTANT: A card's `name` alone is NOT unique.
 * The same card name can be printed across multiple releases / sets.
 * The unique identifier is always `slug` (e.g. "nameless-champion-ambdp-en-001-c").
 * Always join on `slug` or `uuid`, never on `name` alone.
 */
export interface Card {
  /** Unique identifier from GA API */
  uuid: string;
  /** Display name — NOT unique across printings */
  name: string;
  /**
   * Slug — unique per printing.
   * Format: <name>-<set-code>-<collector-number>-<rarity>
   * e.g. "nameless-champion-ambdp-en-001-c"
   */
  slug: string;

  // ── Release / printing ──────────────────────
  /**
   * IMPORTANT: Multiple cards can share a name but belong to different releases.
   * e.g. "Nameless Champion" appears in DOAp and AMBDP.
   * Always store and display the release alongside the card name.
   */
  release: CardRelease;

  // ── Classification ───────────────────────────
  elements: string[];   // e.g. ["Wind"], ["Fire", "Water"]
  classes: string[];    // e.g. ["Guardian", "Warrior"]
  type: string;         // Champion | Ally | Spell | Regalia | ...
  subtypes: string[];   // e.g. ["Human", "Beast"]

  // ── Stats ────────────────────────────────────
  reserveCost: number | null;
  memoryCost: number | null;
  level: number | null;         // Champion only
  life: number | null;          // Champion only
  power: number | null;         // Ally / Regalia
  durability: number | null;    // Regalia

  // ── Text ─────────────────────────────────────
  effectText: string | null;
  flavorText: string | null;

  // ── Visuals ──────────────────────────────────
  imageUrl: string;
  illustrator: string | null;

  // ── Format legality ──────────────────────────
  rarity: CardRarity;           // C | U | R | SR | PR | ...

  // ── Raw GA payloads ──────────────────────────
  raw?: {
    card: Record<string, unknown>;
    edition: Record<string, unknown>;
  };
}

export interface CardRelease {
  /** Set/product code — e.g. "AMBDP", "DOAp", "ALC" */
  setCode: string;
  /** Human-readable set name — e.g. "Mortal Ambition Draft Pack" */
  setName: string;
  /** Collector number — e.g. "EN-001" */
  collectorNumber: string;
  /** Language — e.g. "en", "jp" */
  language: string;
  /** ISO 8601 release date */
  releaseDate: string | null;
}

export type CardRarity = 'C' | 'U' | 'R' | 'SR' | 'PR' | 'EA' | string;

// ─────────────────────────────────────────────
// CardGroup
// ─────────────────────────────────────────────

/**
 * A group of editions that share the same card name.
 * The grid shows one tile per CardGroup (using primaryCard for the image).
 * CardDetails shows all editions so the user can pick which one to add.
 */
export interface CardGroup {
  /** Card display name shared across all editions */
  name: string;
  /** Editions loaded so far; may be expanded after fetch */
  editions: Card[];
  /** The canonical edition shown in the grid tile */
  primaryCard: Card;
}

// ─────────────────────────────────────────────
// Deck
// ─────────────────────────────────────────────

export interface DeckEntry {
  /** References Card.slug — includes release info */
  cardSlug: string;
  card: Card;
  quantity: number;
}

export interface Deck {
  id: number;
  name: string;
  format: DeckFormat;
  entries: DeckEntry[];
  createdAt: string;
  updatedAt: string;
}

export type DeckFormat = 'standard' | 'eternal' | 'draft' | string;

// ─────────────────────────────────────────────
// Search / Filter Query
// ─────────────────────────────────────────────

export type FilterOperator = 'AND' | 'OR';

export interface FilterRule {
  field: keyof Card | 'effectText' | 'reserveCost' | 'memoryCost';
  /** Exact / OR-match values */
  values?: string[];
  /** Substring match (text fields) */
  contains?: string;
  /** Numeric range */
  gte?: number;
  lte?: number;
  eq?: number;
  /** How multiple values within this rule are combined */
  operator?: FilterOperator;
}

export interface FilterQuery {
  /** All rules here must pass (implicit AND between rules) */
  and: FilterRule[];
  /** Any rule matching here will exclude the card */
  not: FilterRule[];
  /** Free-text search against name + effectText */
  text?: string;
}
