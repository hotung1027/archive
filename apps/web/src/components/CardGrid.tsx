'use client';

import Image from 'next/image';
import type { CardGroup } from '@omnisearch/types';
import { useDeckStore } from '@/store/deckStore';

interface Props {
  groups: CardGroup[];
  selectedName: string | null;
  onSelectGroup: (group: CardGroup) => void;
}

export function CardGrid({ groups, selectedName, onSelectGroup }: Props) {
  const { addCard, removeCard, countOfName } = useDeckStore();

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(7.75rem,1fr))] gap-3 2xl:grid-cols-[repeat(auto-fill,minmax(9.25rem,1fr))]">
      {groups.map(group => (
        <CardTile
          key={group.name}
          group={group}
          count={countOfName(group.name)}
          selected={group.name === selectedName}
          onAdd={() => addCard(group.primaryCard)}
          onRemove={() => removeCard(group.primaryCard.slug)}
          onSelect={() => onSelectGroup(group)}
        />
      ))}
    </div>
  );
}

interface TileProps {
  group:    CardGroup;
  count:    number;
  selected: boolean;
  onAdd:    () => void;
  onRemove: () => void;
  onSelect: () => void;
}

function CardTile({ group, count, selected, onAdd, onRemove, onSelect }: TileProps) {
  const card = group.primaryCard;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onDoubleClick={onAdd}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`group relative cursor-pointer overflow-hidden rounded-lg border bg-gray-950 text-left outline-none transition-all duration-150 focus:border-blue-400 ${
        selected
          ? 'border-blue-400 shadow-[0_0_0_1px_rgba(96,165,250,0.65),0_12px_30px_rgba(0,0,0,0.35)]'
          : 'border-gray-800 hover:border-blue-500 hover:bg-gray-900'
      }`}
      title={card.name}
    >
      {/* Card image */}
      <div className="relative aspect-[2.5/3.5] bg-gray-900">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={card.name}
            fill
            className="object-contain p-1"
            sizes="(max-width: 768px) 50vw, 20vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-600">
            No image
          </div>
        )}

        {/* Total count badge across all editions */}
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow">
            {count}
          </span>
        )}
      </div>

      {/* Card info footer */}
      <div className="border-t border-gray-800 p-2">
        <div className="flex items-start gap-1.5">
          <p className="min-w-0 flex-1 truncate text-xs font-medium leading-tight text-gray-200">{card.name}</p>
          {count > 0 && (
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); onRemove(); }}
              className="h-5 w-5 shrink-0 rounded border border-gray-700 bg-gray-900 text-xs text-gray-200 hover:border-red-500 hover:bg-red-900"
              title="Remove from deck"
            >
              -
            </button>
          )}
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); onAdd(); }}
            className="h-5 w-5 shrink-0 rounded border border-gray-700 bg-gray-900 text-xs text-gray-200 hover:border-blue-500 hover:bg-blue-700"
            title="Add to deck"
          >
            +
          </button>
        </div>
        <p className="mt-1 truncate text-xs text-gray-500">
          {card.type}
          {card.elements.length > 0 && ` · ${card.elements.join('/')}`}
          {card.reserveCost != null && ` · ${card.reserveCost} reserve`}
        </p>
      </div>

      {/* Hover overlay */}
      <div className="pointer-events-none absolute inset-0 bg-blue-500/0 transition-colors group-hover:bg-blue-500/10" />
    </div>
  );
}
