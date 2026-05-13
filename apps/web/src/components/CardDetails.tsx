'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Card, CardGroup } from '@omnisearch/types';
import {
  useDeckStore, isMaterialCard,
  MATERIAL_COPY_LIMIT, MAIN_COPY_LIMIT,
} from '@/store/deckStore';
import { usePriceStore, formatPrice } from '@/store/priceStore';
import { parseDbCard } from '@/lib/parseCard';
import { fetchStaticEditions, isStaticExport } from '@/lib/staticCardData';

interface CardDetailsProps {
  group: CardGroup | null;
}

function valueToText(value: unknown): string {
  if (value == null || value === '') return '';
  if (Array.isArray(value)) return value.map(valueToText).filter(Boolean).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function rawValue(source: Record<string, unknown>, key: string): string {
  return valueToText(source[key]);
}

function Badge({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <span className="rounded border border-gray-800 bg-gray-900 px-2 py-0.5 text-xs text-gray-300">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number | null }) {
  if (value == null || value === '') return null;
  return (
    <div className="rounded border border-gray-800 bg-gray-950 px-2 py-2 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-gray-100">{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null;
  return (
    <div className="grid grid-cols-[6.25rem_minmax(0,1fr)] gap-2 border-b border-gray-900 py-1.5 text-xs last:border-b-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className="min-w-0 break-words text-gray-300">{value}</dd>
    </div>
  );
}

function RuleDetails({ value }: { value: unknown }) {
  if (value == null || value === '') return null;

  let ruleValue: unknown = value;
  if (typeof value === 'string') {
    try {
      ruleValue = JSON.parse(value) as unknown;
    } catch {
      return <EffectText text={value} className="text-xs leading-relaxed text-gray-300" />;
    }
  }

  if (Array.isArray(ruleValue)) {
    const renderedRules = ruleValue
      .map((item, index) => <RuleDetails key={index} value={item} />)
      .filter(Boolean);
    if (renderedRules.length === 0) return null;
    return <div className="grid gap-2">{renderedRules}</div>;
  }

  if (!isRecord(ruleValue)) return <EffectText text={String(ruleValue)} className="text-xs leading-relaxed text-gray-300" />;

  const title = valueToText(ruleValue.title).trim();
  const dateAdded = valueToText(ruleValue.date_added ?? ruleValue.dateAdded).trim();
  const description = valueToText(ruleValue.description).trim();

  if (!title && !dateAdded && !description) return null;

  return (
    <div className="rounded border border-gray-800 bg-gray-900/40 px-2 py-1.5">
      {(title || dateAdded) && (
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          {title && <span className="font-semibold text-gray-200">{title}</span>}
          {dateAdded && <span className="rounded bg-gray-950 px-1.5 py-0.5 text-[10px] text-gray-500">{dateAdded}</span>}
        </div>
      )}
      {description && <EffectText text={description} className="text-xs leading-relaxed text-gray-300" />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 rounded border border-gray-800 bg-gray-950/70 px-3 py-2.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function EffectText({ text, className = 'text-sm leading-relaxed text-gray-200' }: { text: string; className?: string }) {
  function parseInline(line: string): React.ReactNode[] {
    const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\])/);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('*') && part.endsWith('*'))
        return <em key={i}>{part.slice(1, -1)}</em>;
      if (part.startsWith('[') && part.endsWith(']'))
        return <span key={i} className="rounded bg-gray-700 px-1 py-0.5 text-xs font-semibold text-yellow-300">{part}</span>;
      return part;
    });
  }
  const lines = text.split('\n');
  return (
    <div className={className}>
      {lines.map((line, i) => (
        <span key={i}>{parseInline(line)}{i < lines.length - 1 && <br />}</span>
      ))}
    </div>
  );
}

export function CardDetails({ group }: CardDetailsProps) {
  const { addCard, countOf, canAddCard, addToSideboard, canAddToSideboard, countInSideboard } = useDeckStore();
  const { prices } = usePriceStore();

  // Track which edition the user has picked; reset when the card name changes
  const [activeEditionSlug, setActiveEditionSlug] = useState<string | null>(null);
  useEffect(() => {
    setActiveEditionSlug(null);
  }, [group?.name]);

  // Fetch all editions for this card name
  const { data: editionsData } = useQuery({
    queryKey: ['editions', group?.name],
    queryFn: async () => {
      if (isStaticExport()) return fetchStaticEditions(group!.name);

      const res = await fetch(`/api/editions?name=${encodeURIComponent(group!.name)}`);
      if (!res.ok) throw new Error(`editions fetch failed: ${res.status}`);
      return res.json();
    },
    enabled: !!group?.name,
  });

  const fetchedEditions: Card[] = (editionsData?.data ?? []).map(
    (row: Parameters<typeof parseDbCard>[0]) => parseDbCard(row)
  );

  // Use fetched editions when available, otherwise fall back to what the grid loaded
  const displayEditions: Card[] = fetchedEditions.length > 0 ? fetchedEditions : (group?.editions ?? []);

  // The currently active edition
  const activeEdition: Card | null =
    displayEditions.find(e => e.slug === activeEditionSlug) ?? displayEditions[0] ?? null;

  if (!group || !activeEdition) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-gray-800 bg-[#0f1520] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-300">Card Details</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-100">No selection</h2>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-gray-600">
          Select a card from the library or deck.
        </div>
      </div>
    );
  }

  const card = activeEdition;
  const sourceCard = card.raw?.card ?? {};
  const sourceEdition = card.raw?.edition ?? {};
  const count = countOf(card.slug);
  const isMat = isMaterialCard(card);
  const zoneName = isMat ? 'Material Deck' : 'Main Deck';
  const limit = isMat ? MATERIAL_COPY_LIMIT : MAIN_COPY_LIMIT;
  const canAdd = canAddCard(card);
  const canSide = canAddToSideboard(card);
  const sideCount = countInSideboard(card.slug);
  const rawJson = JSON.stringify({ card: sourceCard, edition: sourceEdition }, null, 2);

  return (
    <div className="flex h-full flex-col overflow-hidden text-sm">
      <div className="shrink-0 border-b border-gray-800 bg-[#0f1520] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-300">Card Details</p>
        <h2 className="mt-1 text-lg font-semibold leading-snug text-gray-100">{card.name}</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge>{card.type}</Badge>
          <Badge>{card.rarity}</Badge>
          <Badge>{card.release.setCode || 'Unknown set'}</Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Main card image for active edition */}
        <div className="mx-auto max-w-[14.5rem] overflow-hidden rounded-lg border border-gray-800 bg-gray-900 shadow-2xl shadow-black/30 2xl:max-w-[18rem]">
          <div className="relative aspect-[2.5/3.5] bg-gray-950">
            {card.imageUrl ? (
              <Image
                src={card.imageUrl}
                alt={card.name}
                fill
                className="object-contain p-1"
                sizes="18rem"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-600">No image</div>
            )}
          </div>
        </div>

        {/* Edition art picker — only shown when multiple editions exist */}
        {displayEditions.length > 1 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Art Variants ({displayEditions.length})
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {displayEditions.map(ed => (
                <button
                  key={ed.slug}
                  type="button"
                  onClick={() => setActiveEditionSlug(ed.slug)}
                  title={`${ed.release.setName} · ${ed.release.setCode} #${ed.release.collectorNumber}`}
                  className={`relative shrink-0 overflow-hidden rounded border transition-all ${
                    ed.slug === card.slug
                      ? 'border-blue-400 shadow-[0_0_0_1px_rgba(96,165,250,0.5)]'
                      : 'border-gray-700 hover:border-blue-500'
                  }`}
                  style={{ width: '4rem', height: '5.6rem' }}
                >
                  {ed.imageUrl ? (
                    <Image
                      src={ed.imageUrl}
                      alt={ed.release.setCode}
                      fill
                      className="object-contain p-0.5"
                      sizes="64px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-gray-600">?</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-0.5 py-0.5 text-center text-[9px] font-medium text-gray-300 leading-none">
                    {ed.release.setCode}
                  </div>
                  {countOf(ed.slug) > 0 && (
                    <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                      {countOf(ed.slug)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => addCard(card)}
          disabled={!canAdd}
          className={`mt-4 w-full rounded border px-3 py-2 text-sm font-semibold transition-colors ${
            canAdd
              ? 'border-blue-500 bg-blue-700 text-white hover:bg-blue-600'
              : 'cursor-not-allowed border-gray-700 bg-gray-800 text-gray-500'
          }`}
        >
          {canAdd
            ? `Add to ${zoneName}${count > 0 ? ` (${count})` : ''}`
            : `${zoneName} Full (${count}/${limit})`}
        </button>
        <button
          type="button"
          onClick={() => addToSideboard(card)}
          disabled={!canSide}
          className={`mt-2 w-full rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
            canSide
              ? 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600 hover:text-gray-100'
              : 'cursor-not-allowed border-gray-800 bg-gray-900 text-gray-600'
          }`}
        >
          {canSide
            ? `Add to Sideboard${sideCount > 0 ? ` (${sideCount})` : ''}`
            : 'Sideboard Full'}
        </button>

        <div className="mt-4 grid grid-cols-4 gap-2">
          <Stat label="Reserve" value={card.reserveCost} />
          <Stat label="Memory" value={card.memoryCost} />
          <Stat label="Level" value={card.level} />
          <Stat label="Power" value={card.power} />
          <Stat label="Life" value={card.life} />
          <Stat label="Durability" value={card.durability} />
          <Stat label="Qty" value={count || null} />
        </div>

        <Section title="Printing">
          <dl>
            <DetailRow label="Set" value={card.release.setName} />
            <DetailRow label="Code" value={card.release.setCode} />
            <DetailRow label="Collector" value={card.release.collectorNumber} />
            <DetailRow label="Language" value={card.release.language} />
            <DetailRow label="Released" value={card.release.releaseDate} />
            <DetailRow label="Illustrator" value={card.illustrator} />
            <DetailRow label="Config" value={rawValue(sourceEdition, 'configuration')} />
            <DetailRow label="Orientation" value={rawValue(sourceEdition, 'orientation')} />
            {prices[card.name] && (
              <DetailRow
                label="Price"
                value={
                  <span className="font-medium text-green-400">
                    {formatPrice(prices[card.name].cents, prices[card.name].currency)}
                  </span>
                }
              />
            )}
          </dl>
        </Section>

        <Section title="Classification">
          <dl>
            <DetailRow label="Elements" value={card.elements.join(', ')} />
            <DetailRow label="Classes" value={card.classes.join(', ')} />
            <DetailRow label="Subtypes" value={card.subtypes.join(', ')} />
            <DetailRow label="Speed" value={rawValue(sourceCard, 'speed')} />
            <DetailRow
              label="Rule"
              value={sourceCard.rule == null || sourceCard.rule === '' ? null : <RuleDetails value={sourceCard.rule} />}
            />
            <DetailRow label="Legality" value={rawValue(sourceCard, 'legality')} />
          </dl>
        </Section>

        {card.effectText && (
          <Section title="Effect">
            <EffectText text={card.effectText} />
          </Section>
        )}

        {card.flavorText && (
          <Section title="Flavor">
            <p className="whitespace-pre-wrap text-sm italic leading-relaxed text-gray-400">{card.flavorText}</p>
          </Section>
        )}

        <details className="mt-4 rounded border border-gray-800 bg-gray-950/70 px-3 py-2.5">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-gray-500">Source Payload</summary>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-gray-400">
            {rawJson}
          </pre>
        </details>
      </div>
    </div>
  );
}

