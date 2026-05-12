'use client';

import { useState } from 'react';
import type { Card, CardGroup } from '@omnisearch/types';
import { CardSearch } from './CardSearch';
import { CardDetails } from './CardDetails';
import { DeckSidebar } from './DeckSidebar';

/**
 * Root layout: Hearthstone-style split view.
 *
 *  ┌──────────────┬──────────────────────────────┬──────────────────┐
 *  │ Deck sidebar │ Filter bar + card grid       │ Card details     │
 *  └──────────────┴──────────────────────────────┴──────────────────┘
 */
export function DeckBuilder() {
  const [selectedGroup, setSelectedGroup] = useState<CardGroup | null>(null);

  // DeckSidebar still works with individual Cards — wrap into a single-edition CardGroup
  function handleSidebarSelect(card: Card) {
    setSelectedGroup({ name: card.name, editions: [card], primaryCard: card });
  }

  return (
    <div className="h-screen overflow-hidden bg-[#080b12] text-gray-100">
      <div className="grid h-full grid-cols-[16.5rem_minmax(0,1fr)_18.5rem] 2xl:grid-cols-[19.5rem_minmax(0,1fr)_23rem]">
        <aside className="min-w-0 overflow-hidden border-r border-gray-800 bg-gray-950">
          <DeckSidebar selectedSlug={selectedGroup?.primaryCard?.slug ?? null} onSelectCard={handleSidebarSelect} />
        </aside>

        <main className="min-w-0 overflow-hidden bg-[#0b0f17]">
          <CardSearch selectedGroup={selectedGroup} onSelectGroup={setSelectedGroup} />
        </main>

        <aside className="min-w-0 overflow-hidden border-l border-gray-800 bg-gray-950">
          <CardDetails group={selectedGroup} />
        </aside>
      </div>
    </div>
  );
}
