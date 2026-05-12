import type { ApiCard } from './parseCard';

export interface CardApiResponse {
  data: ApiCard[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    lastPage: number;
  };
}

const STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

let cardsPromise: Promise<ApiCard[]> | null = null;

export function isStaticExport() {
  return STATIC_EXPORT;
}

function dataUrl(path: string) {
  return `${BASE_PATH}${path}`;
}

async function loadCards() {
  cardsPromise ??= fetch(dataUrl('/data/cards.json')).then(async response => {
    if (!response.ok) throw new Error(`Static card data failed: ${response.status}`);
    return await response.json() as ApiCard[];
  });
  return cardsPromise;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function includesText(value: string | null | undefined, needle: string) {
  return (value ?? '').toLowerCase().includes(needle.toLowerCase());
}

function matchesMulti(values: string[], selected: string[], mode: string | null) {
  if (selected.length === 0) return true;
  return mode === 'AND'
    ? selected.every(value => values.includes(value))
    : selected.some(value => values.includes(value));
}

function compareCards(a: ApiCard, b: ApiCard) {
  return a.name.localeCompare(b.name) || a.slug.localeCompare(b.slug);
}

function compareSearchCards(text: string | null) {
  return (a: ApiCard, b: ApiCard) => {
    if (text) {
      const aNameMatch = includesText(a.name, text);
      const bNameMatch = includesText(b.name, text);
      if (aNameMatch !== bNameMatch) return aNameMatch ? -1 : 1;
    }
    return compareCards(a, b);
  };
}

function cardMatches(row: ApiCard, params: URLSearchParams) {
  const name = params.get('name');
  const text = params.get('text');
  const elements = params.getAll('element');
  const classes = params.getAll('class');
  const types = params.getAll('type');
  const notTypes = params.getAll('notType');
  const subtypes = params.getAll('subtype');
  const notSubtypes = params.getAll('notSubtype');
  const costMin = params.get('costMin');
  const costMax = params.get('costMax');
  const setCode = params.get('setCode');

  const rowElements = parseJsonArray(row.elements);
  const rowClasses = parseJsonArray(row.classes);
  const rowSubtypes = parseJsonArray(row.subtypes);

  if (name && !includesText(row.name, name)) return false;
  if (text && !includesText(row.name, text) && !includesText(row.effectText, text)) return false;
  if (!matchesMulti(rowElements, elements, params.get('elementMode'))) return false;
  if (!matchesMulti(rowClasses, classes, params.get('classMode'))) return false;
  if (!matchesMulti([row.type], types, params.get('typeMode'))) return false;
  if (notTypes.includes(row.type)) return false;
  if (!matchesMulti(rowSubtypes, subtypes, params.get('subtypeMode'))) return false;
  if (notSubtypes.some(subtype => rowSubtypes.includes(subtype))) return false;
  if (costMin && (row.reserveCost == null || row.reserveCost < Number(costMin))) return false;
  if (costMax && (row.reserveCost == null || row.reserveCost > Number(costMax))) return false;
  if (setCode && row.setCode !== setCode) return false;

  return true;
}

export async function fetchStaticCards(queryString: string): Promise<CardApiResponse> {
  const params = new URLSearchParams(queryString);
  const page = Math.max(1, Number(params.get('page') ?? 1));
  const pageSize = Math.min(Math.max(1, Number(params.get('pageSize') ?? 60)), 200);
  const text = params.get('text');

  const filtered = (await loadCards())
    .filter(row => cardMatches(row, params))
    .sort(compareSearchCards(text));

  const rows = params.get('grouped') === 'true'
    ? Array.from(filtered.reduce((byName, row) => {
        const current = byName.get(row.name);
        if (!current || row.slug < current.slug) byName.set(row.name, row);
        return byName;
      }, new Map<string, ApiCard>()).values()).sort(compareSearchCards(text))
    : filtered;

  const total = rows.length;
  const offset = (page - 1) * pageSize;

  return {
    data: rows.slice(offset, offset + pageSize),
    meta: {
      total,
      page,
      pageSize,
      lastPage: Math.ceil(total / pageSize),
    },
  };
}

export async function fetchStaticEditions(name: string) {
  const data = (await loadCards())
    .filter(row => row.name === name)
    .sort((a, b) => {
      const bDate = Date.parse(b.releaseDate ?? '') || 0;
      const aDate = Date.parse(a.releaseDate ?? '') || 0;
      return bDate - aDate || a.slug.localeCompare(b.slug);
    });

  return { data };
}