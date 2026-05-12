'use client';

import { useQuery } from '@tanstack/react-query';
import { useFilterStore } from '@/store/filterStore';
import { FilterBar } from './FilterBar';
import { CardGrid } from './CardGrid';
import type { CardGroup } from '@omnisearch/types';
import { parseDbCard } from '@/lib/parseCard';
import { fetchStaticCards, isStaticExport } from '@/lib/staticCardData';
import { useEffect, useState } from 'react';

function buildQueryString(
  query: ReturnType<typeof useFilterStore.getState>['query'],
  page: number
): string {
  const params = new URLSearchParams();

  if (query.text) params.set('text', query.text);

  for (const rule of query.and) {
    if (rule.field === 'elements' && rule.values?.length) {
      rule.values.forEach(v => params.append('element', v));
      params.set('elementMode', rule.operator ?? 'OR');
    }
    if (rule.field === 'classes' && rule.values?.length) {
      rule.values.forEach(v => params.append('class', v));
      params.set('classMode', rule.operator ?? 'OR');
    }
    if (rule.field === 'type' && rule.values?.length) {
      rule.values.forEach(v => params.append('type', v));
      params.set('typeMode', rule.operator ?? 'OR');
    }
    if (rule.field === 'subtypes' && rule.values?.length) {
      rule.values.forEach(v => params.append('subtype', v));
      params.set('subtypeMode', rule.operator ?? 'OR');
    }
    if (rule.field === 'reserveCost') {
      if (rule.gte !== undefined) params.set('costMin', String(rule.gte));
      if (rule.lte !== undefined) params.set('costMax', String(rule.lte));
    }
  }

  for (const rule of query.not) {
    if (rule.field === 'type' && rule.values?.length) {
      rule.values.forEach(v => params.append('notType', v));
    }
    if (rule.field === 'subtypes' && rule.values?.length) {
      rule.values.forEach(v => params.append('notSubtype', v));
    }
  }

  params.set('page', String(page));
  params.set('pageSize', '60');
  params.set('grouped', 'true');

  return params.toString();
}

interface CardSearchProps {
  selectedGroup: CardGroup | null;
  onSelectGroup: (group: CardGroup) => void;
}

export function CardSearch({ selectedGroup, onSelectGroup }: CardSearchProps) {
  const { query } = useFilterStore();
  const [page, setPage] = useState(1);

  const qs = buildQueryString(query, page);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['cards', qs],
    queryFn:  async () => {
      if (isStaticExport()) return fetchStaticCards(qs);

      const response = await fetch(`/api/cards?${qs}`);
      if (!response.ok) throw new Error(`Cards API failed: ${response.status}`);
      return response.json();
    },
  });

  const groups: CardGroup[] = (data?.data ?? []).map((row: Parameters<typeof parseDbCard>[0]) => {
    const card = parseDbCard(row);
    return { name: card.name, editions: [card], primaryCard: card };
  });
  const meta = data?.meta;

  // Auto-select the first group when results change and nothing is selected
  useEffect(() => {
    if (!selectedGroup && groups.length > 0) onSelectGroup(groups[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [query]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-gray-800 bg-gray-950/70 px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-300">Card Library</p>
            <h1 className="truncate text-lg font-semibold text-gray-100">Grand Archive Search</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-gray-400">
            <span className="rounded border border-gray-800 bg-gray-900 px-2 py-1">
              {meta ? `${meta.total} cards` : 'Loading'}
            </span>
            <span className={`rounded border px-2 py-1 ${isFetching ? 'border-blue-700 bg-blue-950/60 text-blue-200' : 'border-gray-800 bg-gray-900'}`}>
              {isFetching ? 'Syncing' : 'Ready'}
            </span>
          </div>
        </div>
      </header>

      <FilterBar onFilterChange={() => setPage(1)} />

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!isLoading && !isError && meta && (
          <div className="mb-3 flex items-center justify-between gap-3 text-xs text-gray-500">
            <span>Showing {groups.length} cards on this page</span>
            <span>Page {meta.page} of {Math.max(meta.lastPage, 1)}</span>
          </div>
        )}

        {isLoading && (
          <div className="mt-12 rounded border border-gray-800 bg-gray-950/70 px-4 py-8 text-center text-sm text-gray-400">
            Loading cards...
          </div>
        )}

        {isError && (
          <div className="mt-12 rounded border border-red-900/70 bg-red-950/30 px-4 py-8 text-center text-sm text-red-300">
            Failed to load cards. Run <code className="rounded bg-red-950 px-1">bun run db:seed</code> and restart the app.
          </div>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <div className="mt-12 rounded border border-gray-800 bg-gray-950/70 px-4 py-8 text-center text-sm text-gray-500">
            No cards match the current filters.
          </div>
        )}

        {groups.length > 0 && (
          <>
            <CardGrid
              groups={groups}
              selectedName={selectedGroup?.name ?? null}
              onSelectGroup={onSelectGroup}
            />

            {meta && meta.lastPage > 1 && (
              <div className="mt-6 flex items-center justify-center gap-3 pb-4">
                <button
                  type="button"
                  className="rounded border border-gray-800 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Prev
                </button>
                <span className="text-xs text-gray-400">
                  Page {page} of {meta.lastPage}
                </span>
                <button
                  type="button"
                  className="rounded border border-gray-800 bg-gray-900 px-3 py-1.5 text-sm text-gray-200 hover:border-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setPage(p => Math.min(meta.lastPage, p + 1))}
                  disabled={page === meta.lastPage}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
