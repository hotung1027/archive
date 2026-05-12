/**
 * Lazy-loaded WASM filter engine.
 *
 * Usage:
 *   import { filterCards } from '@omnisearch/search-wasm';
 *   const filtered = await filterCards(cards, query);
 *
 * The WASM module is compiled from packages/search-wasm and output
 * to packages/search-wasm-bindings/wasm/ via:
 *   bun run wasm:build
 */
import type { Card, FilterQuery } from '@omnisearch/types';

// Lazily loaded so it doesn't block SSR or initial render
let wasmModule: typeof import('./wasm/omnisearch_search_wasm') | null = null;

async function getWasm() {
  if (!wasmModule) {
    const mod = await import('./wasm/omnisearch_search_wasm');
    await mod.default(); // initialise wasm binary
    wasmModule = mod;
  }
  return wasmModule;
}

/**
 * Filter `cards` using the given `query` via the Rust WASM engine.
 * Falls back to returning all cards if WASM is not yet compiled.
 */
export async function filterCards(cards: Card[], query: FilterQuery): Promise<Card[]> {
  try {
    const wasm = await getWasm();
    const result = wasm.filter_cards(JSON.stringify(cards), JSON.stringify(query));
    return JSON.parse(result) as Card[];
  } catch {
    // WASM not compiled yet — return full list so the UI still works
    console.warn('[search-wasm] WASM not available, returning unfiltered cards. Run: bun run wasm:build');
    return cards;
  }
}
