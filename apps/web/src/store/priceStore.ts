import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DeckCard } from './deckStore';

export interface PriceEntry {
  /** Cheapest listing in cents (USD) */
  cents: number;
  currency: string;
  updatedAt: string;
}

interface PriceStore {
  /** Prices keyed by card name (prices are per printing name, not per slug) */
  prices: Record<string, PriceEntry>;
  isLoading: boolean;
  error: string | null;
  fetchPricesForDeck: (entries: DeckCard[], sideboardEntries?: DeckCard[]) => Promise<void>;
  clearPrices: () => void;
}

// ---------------------------------------------------------------------------
// TCG Tracking API (https://tcgtracking.com/tcgapi/)
// Public, no auth, CORS-enabled — safe to call directly from the browser.
// ---------------------------------------------------------------------------

const TCG_BASE = 'https://tcgtracking.com/tcgapi/v1';
const GA_CATEGORY_ID = 74;

/**
 * Maps DB set_code values to TCG Tracking abbreviations when they differ.
 * Direct matches (ALC, MRC, FTC, HVN, …) need no entry here — they resolve
 * automatically via the live set index.
 */
const SET_CODE_OVERRIDES: Record<string, string> = {
  // Alchemical Revolution — TCG only tracks the unified set as "ALC"
  'ALC 1st': 'ALC',
  // Ambrosia — TCG uses "AMB1E" for both editions
  'AMB': 'AMB1E',
  'AMB 1st': 'AMB1E',
  // Distorted Reflections — TCG uses "DTR1E"
  'DTR': 'DTR1E',
  'DTR 1st': 'DTR1E',
  // Abyssal Heaven — no separate 1st edition in TCG
  'HVN 1st': 'HVN',
  // Mercurial Heart — no separate 1st edition; Alter maps to "MH Alter"
  'MRC 1st': 'MRC',
  'MRC Alter': 'MH Alter',
  // Phantom Monarchs
  'PTM 1st': 'PTM',
  'PTMEVP': 'PHME',
  // Radiant Origins
  'RDO 1st': 'RDO',
  // Re:Collection sets — TCG uses different abbreviations
  'ReC-AUR': 'AURR',
  'ReC-BRV': 'BRLVST',
  'ReC-HVF': 'HVNFV',
  'ReC-IDY': 'IDLCRS',
  'ReC-SHD': 'SHD',
  'ReC-SLM': 'SLM',
  // Yearly promo sets all live under the single TCG "Promotional Cards" set
  'P22': 'P',
  'P23': 'P',
  'P24': 'P',
  'P25': 'P',
  'P26': 'P',
};

// ---------------------------------------------------------------------------
// Internal types for TCG Tracking responses
// ---------------------------------------------------------------------------

interface TcgSet {
  id: number;
  abbreviation: string;
}

interface TcgProduct {
  id: number;
  name: string;
}

interface TcgPriceSubtype {
  low?: number;
  market?: number;
}

interface TcgPricingEntry {
  tcg?: Record<string, TcgPriceSubtype>;
}

// ---------------------------------------------------------------------------
// Module-level cache — lives for the lifetime of the page
// ---------------------------------------------------------------------------

/** abbreviation → set_id */
let cachedSetIndex: Map<string, number> | null = null;

async function getSetIndex(): Promise<Map<string, number>> {
  if (cachedSetIndex) return cachedSetIndex;
  const resp = await fetch(`${TCG_BASE}/${GA_CATEGORY_ID}/sets`);
  if (!resp.ok) throw new Error(`TCG Tracking: failed to fetch sets (${resp.status})`);
  const data = await resp.json() as { sets: TcgSet[] };
  const map = new Map<string, number>();
  for (const s of data.sets) {
    map.set(s.abbreviation, s.id);
  }
  cachedSetIndex = map;
  return map;
}

function resolveSetId(setCode: string, index: Map<string, number>): number | undefined {
  const overrideAbbr = SET_CODE_OVERRIDES[setCode];
  if (overrideAbbr !== undefined) return index.get(overrideAbbr);
  return index.get(setCode);
}

/**
 * Fetch products and pricing for a single set in parallel.
 * Returns:
 *   nameToId — lowercase card name → TCG product id
 *   idToPrice — product id → cheapest price in USD cents
 */
async function fetchSetData(setId: number): Promise<{
  nameToId: Map<string, number>;
  idToPrice: Map<number, number>;
}> {
  const [productsRes, pricingRes] = await Promise.all([
    fetch(`${TCG_BASE}/${GA_CATEGORY_ID}/sets/${setId}`),
    fetch(`${TCG_BASE}/${GA_CATEGORY_ID}/sets/${setId}/pricing`),
  ]);
  if (!productsRes.ok || !pricingRes.ok) {
    throw new Error(`TCG Tracking: failed to fetch data for set ${setId}`);
  }
  const [productsData, pricingData] = await Promise.all([
    productsRes.json() as Promise<{ products: TcgProduct[] }>,
    pricingRes.json() as Promise<{ prices: Record<string, TcgPricingEntry> }>,
  ]);

  // lowercase name → product id
  const nameToId = new Map<string, number>();
  for (const p of productsData.products ?? []) {
    nameToId.set(p.name.toLowerCase(), p.id);
  }

  // product id → cheapest price in cents
  // Prices from TCG Tracking are in USD dollars — multiply by 100.
  // Prefer "Normal" over "Foil"; prefer "low" (cheapest listing) over "market".
  const idToPrice = new Map<number, number>();
  for (const [idStr, entry] of Object.entries(pricingData.prices ?? {})) {
    const id = Number(idStr);
    const tcg = entry.tcg;
    if (!tcg) continue;
    const low = tcg['Normal']?.low ?? tcg['Foil']?.low;
    if (low !== undefined && low > 0) {
      idToPrice.set(id, Math.round(low * 100));
    }
  }

  return { nameToId, idToPrice };
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

export const usePriceStore = create<PriceStore>()(
  persist(
    (set, get) => ({
      prices: {},
      isLoading: false,
      error: null,

      fetchPricesForDeck: async (entries, sideboardEntries = []) => {
        set({ isLoading: true, error: null });

        try {
          const allEntries = [...entries, ...sideboardEntries];

          // Deduplicate by setCode + card name
          const seen = new Set<string>();
          const uniqueCards: Array<{ name: string; setCode: string }> = [];
          for (const e of allEntries) {
            const key = `${e.card.release.setCode}|${e.card.name}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueCards.push({ name: e.card.name, setCode: e.card.release.setCode });
            }
          }

          // Resolve set codes → TCG set ids
          const index = await getSetIndex();

          const setToCards = new Map<number, string[]>();
          for (const card of uniqueCards) {
            const setId = resolveSetId(card.setCode, index);
            if (setId === undefined) continue; // unknown/unmapped set — skip
            if (!setToCards.has(setId)) setToCards.set(setId, []);
            setToCards.get(setId)!.push(card.name);
          }

          // Fetch products + pricing for each unique set in parallel
          const results = await Promise.all(
            Array.from(setToCards.keys()).map(async (setId) => {
              const data = await fetchSetData(setId);
              return { setId, ...data };
            }),
          );

          // Merge into the persisted price map
          const updatedAt = new Date().toISOString();
          const newPrices: Record<string, PriceEntry> = { ...get().prices };

          for (const { setId, nameToId, idToPrice } of results) {
            for (const cardName of setToCards.get(setId) ?? []) {
              const productId = nameToId.get(cardName.toLowerCase());
              if (productId === undefined) continue;
              const cents = idToPrice.get(productId);
              if (cents === undefined) continue;
              newPrices[cardName] = { cents, currency: 'USD', updatedAt };
            }
          }

          set({ prices: newPrices, isLoading: false });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },

      clearPrices: () => set({ prices: {} }),
    }),
    {
      name: 'price-storage',
      // Only persist prices — not transient loading/error state
      partialize: (s) => ({ prices: s.prices }),
    },
  ),
);

/** Format cents as "$X.XX" */
export function formatPrice(cents: number, currency = 'USD'): string {
  if (currency === 'EUR') return `€${(cents / 100).toFixed(2)}`;
  return `$${(cents / 100).toFixed(2)}`;
}
