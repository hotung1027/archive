'use client';

import { useState } from 'react';
import {
  useDeckStore, isMaterialCard,
  MATERIAL_DECK_EXACT, MAIN_DECK_MIN, SIDEBOARD_MAX,
} from '@/store/deckStore';
import type { DeckCard } from '@/store/deckStore';
import type { Card } from '@omnisearch/types';

interface DeckSidebarProps {
  selectedSlug: string | null;
  onSelectCard: (card: Card) => void;
}

export function DeckSidebar({ selectedSlug, onSelectCard }: DeckSidebarProps) {
  const [activeTab, setActiveTab] = useState<'deck' | 'sideboard'>('deck');
  const [hoveredCard, setHoveredCard] = useState<Card | null>(null);
  const [hoverY, setHoverY] = useState(0);
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);

  const {
    deckName, format, entries,
    sideboardEntries: rawSideboard,
    addCard, removeCard, removeAllOf,
    addToSideboard, removeFromSideboard, removeAllFromSideboard,
    clearDeck, clearSideboard, deckStats,
  } = useDeckStore();

  const sideboardEntries = rawSideboard ?? [];
  const stats = deckStats();

  const materialEntries = [...entries.filter(e => isMaterialCard(e.card))]
    .sort((a, b) => a.card.name.localeCompare(b.card.name));
  const mainEntries = [...entries.filter(e => !isMaterialCard(e.card))]
    .sort((a, b) => a.card.name.localeCompare(b.card.name));
  const sortedSideboard = [...sideboardEntries]
    .sort((a, b) => a.card.name.localeCompare(b.card.name));

  function buildExportText() {
    const lines: string[] = [];
    lines.push('# Material Deck');
    for (const e of materialEntries) lines.push(`${e.quantity} ${e.card.name}`);
    lines.push('');
    lines.push('# Main Deck');
    for (const e of mainEntries) lines.push(`${e.quantity} ${e.card.name}`);
    lines.push('');
    lines.push('# Sideboard');
    for (const e of sortedSideboard) lines.push(`${e.quantity} ${e.card.name}`);
    return lines.join('\n');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildExportText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative flex h-full flex-col text-sm">
      {/* ── Hover card preview ─────────────────────────────────────── */}
      {hoveredCard?.imageUrl && (
        <div
          className="pointer-events-none fixed z-[9999] w-44 overflow-hidden rounded-lg border border-gray-600 bg-gray-950 shadow-2xl"
          style={{ left: 'calc(16.5rem + 12px)', top: Math.max(8, hoverY - 120) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hoveredCard.imageUrl} alt={hoveredCard.name} className="w-full" />
          <p className="truncate px-2 py-1 text-[11px] text-gray-300">{hoveredCard.name}</p>
        </div>
      )}

      {/* ── Export modal ─────────────────────────────────────────── */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-[28rem] max-w-[90vw] rounded-lg border border-gray-700 bg-gray-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-100">Export Deck — Omnidex Format</h3>
              <button type="button" onClick={() => setShowExport(false)} className="text-gray-500 hover:text-gray-200">✕</button>
            </div>
            <div className="p-4">
              <textarea
                readOnly
                value={buildExportText()}
                className="h-72 w-full resize-none rounded border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-xs text-gray-200 focus:outline-none"
                onClick={e => (e.target as HTMLTextAreaElement).select()}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded border border-gray-700 bg-gray-900 px-4 py-1.5 text-xs text-gray-200 hover:border-blue-500 hover:bg-blue-900"
                >
                  {copied ? '✓ Copied!' : 'Copy to Clipboard'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowExport(false)}
                  className="rounded border border-gray-800 bg-gray-950 px-4 py-1.5 text-xs text-gray-400 hover:border-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-gray-800 bg-[#0f1520] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-300">Current Deck</p>
            <h2 className="mt-1 truncate text-lg font-semibold text-gray-100">{deckName}</h2>
            <div className="mt-1 text-xs text-gray-500">
              <span className="rounded border border-gray-800 bg-gray-950 px-2 py-0.5 uppercase">{format}</span>
            </div>
          </div>
          <div className="mt-1 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setShowExport(true)}
              className="rounded border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-gray-300 transition-colors hover:border-blue-600 hover:text-blue-300"
              title="Export deck"
            >
              Export
            </button>
            <button
              type="button"
              onClick={activeTab === 'deck' ? clearDeck : clearSideboard}
              className="rounded border border-gray-800 bg-gray-950 px-2 py-1 text-xs text-gray-400 transition-colors hover:border-red-800 hover:text-red-300"
              title={activeTab === 'deck' ? 'Clear deck' : 'Clear sideboard'}
            >
              Clear
            </button>
          </div>
        </div>

        {/* Tab toggle */}
        <div className="mt-3 flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('deck')}
            className={`flex-1 rounded px-2 py-1.5 font-medium transition-colors ${
              activeTab === 'deck'
                ? 'bg-blue-900/80 text-blue-200'
                : 'bg-gray-900 text-gray-400 hover:text-gray-200'
            }`}
          >
            Deck
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sideboard')}
            className={`flex-1 rounded px-2 py-1.5 font-medium transition-colors ${
              activeTab === 'sideboard'
                ? 'bg-blue-900/80 text-blue-200'
                : 'bg-gray-900 text-gray-400 hover:text-gray-200'
            }`}
          >
            Side {stats.sideboardCount > 0 ? `(${stats.sideboardCount})` : ''}
          </button>
        </div>

        {activeTab === 'deck' && <ManaCurve entries={entries} />}
      </div>

      {/* ── Content ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'deck' ? (
          <>
            {/* Material Deck zone */}
            <ZoneHeader
              label="Material Deck"
              count={stats.materialCount}
              target={MATERIAL_DECK_EXACT}
              exact
            />
            {materialEntries.length === 0 ? (
              <EmptyZone hint="Champion & Regalia cards go here" />
            ) : (
              materialEntries.map(entry => (
                <DeckEntry
                  key={entry.card.slug}
                  entry={entry}
                  selected={entry.card.slug === selectedSlug}
                  onSelect={() => onSelectCard(entry.card)}
                  onAdd={() => addCard(entry.card)}
                  onRemove={() => removeCard(entry.card.slug)}
                  onRemoveAll={() => removeAllOf(entry.card.slug)}
                  onHover={(card, y) => { setHoveredCard(card); setHoverY(y); }}
                  onHoverEnd={() => setHoveredCard(null)}
                />
              ))
            )}

            {/* Main Deck zone */}
            <ZoneHeader
              label="Main Deck"
              count={stats.mainCount}
              target={MAIN_DECK_MIN}
              exact={false}
            />
            {mainEntries.length === 0 ? (
              <EmptyZone hint="Actions, Allies, Items and more" />
            ) : (
              mainEntries.map(entry => (
                <DeckEntry
                  key={entry.card.slug}
                  entry={entry}
                  selected={entry.card.slug === selectedSlug}
                  onSelect={() => onSelectCard(entry.card)}
                  onAdd={() => addCard(entry.card)}
                  onRemove={() => removeCard(entry.card.slug)}
                  onRemoveAll={() => removeAllOf(entry.card.slug)}
                  onHover={(card, y) => { setHoveredCard(card); setHoverY(y); }}
                  onHoverEnd={() => setHoveredCard(null)}
                />
              ))
            )}

            {/* Validation errors */}
            {stats.errors.length > 0 && (
              <div className="mx-3 my-3 space-y-1 rounded border border-yellow-900/50 bg-yellow-950/20 px-3 py-2">
                {stats.errors.map(err => (
                  <p key={err} className="text-[11px] text-yellow-400">⚠ {err}</p>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Sideboard zone */}
            <ZoneHeader
              label="Sideboard"
              count={stats.sideboardCount}
              target={SIDEBOARD_MAX}
              exact={false}
            />
            {sortedSideboard.length === 0 ? (
              <EmptyZone hint="Add cards to swap in during competitive play" />
            ) : (
              sortedSideboard.map(entry => (
                <DeckEntry
                  key={entry.card.slug}
                  entry={entry}
                  selected={entry.card.slug === selectedSlug}
                  onSelect={() => onSelectCard(entry.card)}
                  onAdd={() => addToSideboard(entry.card)}
                  onRemove={() => removeFromSideboard(entry.card.slug)}
                  onRemoveAll={() => removeAllFromSideboard(entry.card.slug)}
                  onHover={(card, y) => { setHoveredCard(card); setHoverY(y); }}
                  onHoverEnd={() => setHoveredCard(null)}
                />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Zone header ──────────────────────────────────────────────────────────────

function ZoneHeader({
  label, count, target, exact,
}: {
  label: string;
  count: number;
  target: number;
  exact: boolean;
}) {
  const ok = exact ? count === target : count >= target;
  const countStr = exact
    ? `${count}/${target}`
    : count >= target
      ? `${count}`
      : `${count}/${target}+`;

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-800/60 bg-gray-950/95 px-4 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</span>
      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
        ok ? 'bg-green-950 text-green-400' : 'bg-gray-900 text-gray-500'
      }`}>
        {countStr}
      </span>
    </div>
  );
}

function EmptyZone({ hint }: { hint: string }) {
  return (
    <div className="mx-3 mt-3 rounded border border-dashed border-gray-800 bg-gray-950/60 px-3 py-5 text-center text-[11px] text-gray-600">
      {hint}
    </div>
  );
}

// ── Deck entry row ───────────────────────────────────────────────────────────

function DeckEntry({
  entry, selected, onSelect, onAdd, onRemove, onRemoveAll, onHover, onHoverEnd,
}: {
  entry: DeckCard;
  selected: boolean;
  onSelect: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onRemoveAll: () => void;
  onHover: (card: Card, mouseY: number) => void;
  onHoverEnd: () => void;
}) {
  const { card, quantity } = entry;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      onMouseEnter={(e) => onHover(card, e.clientY)}
      onMouseMove={(e) => onHover(card, e.clientY)}
      onMouseLeave={onHoverEnd}
      className={`group flex items-center gap-2 border-b border-gray-900 px-3 py-2 outline-none transition-colors ${
        selected ? 'bg-blue-950/50' : 'hover:bg-gray-900/80 focus:bg-gray-900/80'
      }`}
    >
      <span className="w-7 shrink-0 rounded border border-gray-800 bg-gray-950 px-1 py-0.5 text-center text-xs font-bold text-gray-300">
        {quantity}x
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-gray-200">{card.name}</p>
        <p className="truncate text-[11px] text-gray-600">
          {card.release.setCode} · {card.release.collectorNumber}
        </p>
      </div>

      {card.reserveCost != null && (
        <span className="shrink-0 rounded bg-gray-900 px-1.5 py-0.5 text-[11px] text-gray-500">
          {card.reserveCost}
        </span>
      )}

      <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className="flex h-5 w-5 items-center justify-center rounded border border-gray-700 bg-gray-900 text-xs hover:border-green-600 hover:bg-green-900"
          title="Add one"
        >+</button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="flex h-5 w-5 items-center justify-center rounded border border-gray-700 bg-gray-900 text-xs hover:border-red-600 hover:bg-red-900"
          title="Remove one"
        >-</button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemoveAll(); }}
          className="flex h-5 w-5 items-center justify-center rounded border border-gray-700 bg-gray-900 text-xs hover:border-red-700 hover:bg-red-950"
          title="Remove all"
        >×</button>
      </div>
    </div>
  );
}

// ── Mana curve ───────────────────────────────────────────────────────────────

function ManaCurve({ entries }: { entries: DeckCard[] }) {
  const costs = Array.from({ length: 9 }, (_, i) => i); // 0–8+
  const bins = new Map<number, number>();

  for (const e of entries) {
    const cost = e.card.reserveCost ?? -1;
    const bucket = cost < 0 ? -1 : Math.min(cost, 8);
    bins.set(bucket, (bins.get(bucket) ?? 0) + e.quantity);
  }

  const max = Math.max(...Array.from(bins.values()), 1);
  const total = Array.from(bins.values()).reduce((s, v) => s + v, 0);

  if (total === 0) return null;

  return (
    <div className="mt-3">
      <div className="flex h-8 items-end gap-1">
        {costs.map(c => {
          const count = bins.get(c) ?? 0;
          const height = Math.round((count / max) * 100);
          return (
            <div
              key={c}
              className="flex-1 rounded-sm bg-blue-700/80 transition-all"
              style={{ height: `${height}%`, minHeight: count > 0 ? 4 : 1 }}
              title={`Cost ${c === 8 ? '8+' : c}: ${count}`}
            />
          );
        })}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] text-gray-600">
        {costs.map(c => (
          <span key={c} className="flex-1 text-center">{c === 8 ? '8+' : c}</span>
        ))}
      </div>
    </div>
  );
}

