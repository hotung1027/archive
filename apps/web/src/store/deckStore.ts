import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Card } from '@omnisearch/types';

export interface DeckCard {
  card: Card;
  quantity: number;
}

// ── GA deck rules ─────────────────────────────────────────────────────────
export const MATERIAL_COPY_LIMIT = 1;   // 1 copy per name in material deck
export const MAIN_COPY_LIMIT      = 4;  // 4 copies per name in main deck
export const MATERIAL_DECK_EXACT  = 12; // Exactly 12 material cards
export const MAIN_DECK_MIN        = 60; // At least 60 main deck cards
export const SIDEBOARD_MAX        = 15; // Up to 15 sideboard cards

/** Champion and Regalia cards belong to the Material Deck */
export function isMaterialCard(card: Card): boolean {
  return card.type === 'Champion' || card.type === 'Regalia';
}

export interface DeckStats {
  materialCount:  number;
  mainCount:      number;
  sideboardCount: number;
  errors:         string[];
}

interface DeckStore {
  deckId:           number | null;
  deckName:         string;
  format:           string;
  entries:          DeckCard[];
  sideboardEntries: DeckCard[];

  // Main / Material deck actions
  setDeck:      (id: number, name: string, format: string) => void;
  addCard:      (card: Card) => void;
  removeCard:   (slug: string) => void;
  removeAllOf:  (slug: string) => void;
  setQuantity:  (slug: string, qty: number) => void;
  clearDeck:    () => void;

  // Sideboard actions
  addToSideboard:         (card: Card) => void;
  removeFromSideboard:    (slug: string) => void;
  removeAllFromSideboard: (slug: string) => void;
  clearSideboard:         () => void;

  // Computed helpers
  totalCards:             () => number;
  countOf:                (slug: string) => number;
  countOfName:            (name: string) => number;
  canAddCard:             (card: Card) => boolean;
  countInSideboard:       (slug: string) => number;
  countOfNameInSideboard: (name: string) => number;
  canAddToSideboard:      (card: Card) => boolean;
  deckStats:              () => DeckStats;
}

export const useDeckStore = create<DeckStore>()(
  persist(
    (set, get) => ({
      deckId:           null,
      deckName:         'New Deck',
      format:           'standard',
      entries:          [],
      sideboardEntries: [],

      setDeck: (id, name, format) => set({ deckId: id, deckName: name, format }),

      addCard: (card) => {
        if (!get().canAddCard(card)) return;
        set(s => {
          const existing = s.entries.find(e => e.card.slug === card.slug);
          if (existing) {
            return {
              entries: s.entries.map(e =>
                e.card.slug === card.slug ? { ...e, quantity: e.quantity + 1 } : e
              ),
            };
          }
          return { entries: [...s.entries, { card, quantity: 1 }] };
        });
      },

      removeCard: (slug) => set(s => ({
        entries: s.entries
          .map(e => e.card.slug === slug ? { ...e, quantity: e.quantity - 1 } : e)
          .filter(e => e.quantity > 0),
      })),

      removeAllOf: (slug) => set(s => ({
        entries: s.entries.filter(e => e.card.slug !== slug),
      })),

      setQuantity: (slug, qty) => set(s => ({
        entries: qty <= 0
          ? s.entries.filter(e => e.card.slug !== slug)
          : s.entries.map(e => e.card.slug === slug ? { ...e, quantity: qty } : e),
      })),

      clearDeck: () => set({ entries: [] }),

      addToSideboard: (card) => {
        if (!get().canAddToSideboard(card)) return;
        set(s => {
          const sb = s.sideboardEntries ?? [];
          const existing = sb.find(e => e.card.slug === card.slug);
          if (existing) {
            return {
              sideboardEntries: sb.map(e =>
                e.card.slug === card.slug ? { ...e, quantity: e.quantity + 1 } : e
              ),
            };
          }
          return { sideboardEntries: [...sb, { card, quantity: 1 }] };
        });
      },

      removeFromSideboard: (slug) => set(s => ({
        sideboardEntries: (s.sideboardEntries ?? [])
          .map(e => e.card.slug === slug ? { ...e, quantity: e.quantity - 1 } : e)
          .filter(e => e.quantity > 0),
      })),

      removeAllFromSideboard: (slug) => set(s => ({
        sideboardEntries: (s.sideboardEntries ?? []).filter(e => e.card.slug !== slug),
      })),

      clearSideboard: () => set({ sideboardEntries: [] }),

      totalCards: () => get().entries.reduce((sum, e) => sum + e.quantity, 0),

      countOf: (slug) => get().entries.find(e => e.card.slug === slug)?.quantity ?? 0,

      countOfName: (name) =>
        get().entries.filter(e => e.card.name === name).reduce((sum, e) => sum + e.quantity, 0),

      canAddCard: (card) => {
        const { entries } = get();
        const isMat = isMaterialCard(card);
        if (isMat) {
          const count = entries
            .filter(e => isMaterialCard(e.card) && e.card.name === card.name)
            .reduce((sum, e) => sum + e.quantity, 0);
          return count < MATERIAL_COPY_LIMIT;
        }
        const count = entries
          .filter(e => !isMaterialCard(e.card) && e.card.name === card.name)
          .reduce((sum, e) => sum + e.quantity, 0);
        return count < MAIN_COPY_LIMIT;
      },

      countInSideboard: (slug) =>
        (get().sideboardEntries ?? []).find(e => e.card.slug === slug)?.quantity ?? 0,

      countOfNameInSideboard: (name) =>
        (get().sideboardEntries ?? [])
          .filter(e => e.card.name === name)
          .reduce((sum, e) => sum + e.quantity, 0),

      canAddToSideboard: (card) => {
        const sb = get().sideboardEntries ?? [];
        const totalSb = sb.reduce((sum, e) => sum + e.quantity, 0);
        if (totalSb >= SIDEBOARD_MAX) return false;
        const limit = isMaterialCard(card) ? MATERIAL_COPY_LIMIT : MAIN_COPY_LIMIT;
        const count = sb
          .filter(e => e.card.name === card.name)
          .reduce((sum, e) => sum + e.quantity, 0);
        return count < limit;
      },

      deckStats: () => {
        const { entries, sideboardEntries: sb = [] } = get();
        const matEntries  = entries.filter(e => isMaterialCard(e.card));
        const mainEntries = entries.filter(e => !isMaterialCard(e.card));

        const materialCount  = matEntries.reduce((sum, e)  => sum + e.quantity, 0);
        const mainCount      = mainEntries.reduce((sum, e) => sum + e.quantity, 0);
        const sideboardCount = sb.reduce((sum, e)          => sum + e.quantity, 0);

        const errors: string[] = [];
        if (materialCount !== MATERIAL_DECK_EXACT) {
          const diff = MATERIAL_DECK_EXACT - materialCount;
          errors.push(
            diff > 0
              ? `Material deck needs ${diff} more card${diff !== 1 ? 's' : ''} (${materialCount}/${MATERIAL_DECK_EXACT})`
              : `Material deck has ${-diff} too many cards (${materialCount}/${MATERIAL_DECK_EXACT})`
          );
        }
        if (mainCount < MAIN_DECK_MIN) {
          const diff = MAIN_DECK_MIN - mainCount;
          errors.push(
            `Main deck needs ${diff} more card${diff !== 1 ? 's' : ''} (${mainCount}/${MAIN_DECK_MIN})`
          );
        }

        return { materialCount, mainCount, sideboardCount, errors };
      },
    }),
    {
      name: 'omnisearch-deck',
      skipHydration: true,
    }
  )
);
